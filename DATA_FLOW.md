# Data Flow Documentation - Raindrop Bear

This document illustrates how data flows through the Raindrop Bear extension.

## Overview Architecture

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Chrome    │ ◄────── │  Background  │ ───────► │  Raindrop   │
│  Bookmarks  │         │   Service    │         │     API     │
│             │         │    Worker    │         │             │
└─────────────┘         └──────────────┘         └─────────────┘
      ▲                        │
      │                        │
      │                   ┌────▼────┐
      │                   │  Storage │
      │                   │  (State) │
      │                   └─────────┘
      │
┌─────▼──────┐
│   Popup    │
│   UI       │
└───────────┘
```

---

## 1. Authentication Flow

### OAuth Flow
```
User clicks "Login with Raindrop"
         │
         ▼
Popup opens OAuth URL → https://ohauth.vercel.app/oauth/raindrop
         │
         ▼
OAuth server redirects with tokens
         │
         ▼
External message received → oauth.js
         │
         ▼
Store tokens in chrome.storage.sync
    ├─ oauthAccessToken
    ├─ oauthRefreshToken
    └─ oauthExpiresAt (computed: now + expires_in * 1000)
         │
         ▼
Storage change listener triggers → background.js
         │
         ▼
Delete local data + Full sync → performSync()
```

### Test Token Flow
```
User enters token in Options page
         │
         ▼
Save to chrome.storage.local
    └─ raindropApiToken
         │
         ▼
Storage change listener triggers → background.js
         │
         ▼
Set token in api-facade.js → setFacadeToken()
         │
         ▼
Trigger sync → performSync()
```

### Token Priority (getActiveToken)
```
Request for API call
         │
         ▼
Check chrome.storage.local → raindropApiToken
         │
         ├─ Found & non-empty? ────────► Use test token ✅
         │
         └─ Not found/empty?
                  │
                  ▼
         Check chrome.storage.sync → oauthAccessToken
                  │
                  ├─ Found? Check expiry
                  │   │
                  │   ├─ Expiring soon (< 10 min)?
                  │   │   │
                  │   │   ▼
                  │   │   Refresh via oauth.vercel.app
                  │   │   │
                  │   │   ▼
                  │   │   Update sync storage
                  │   │   │
                  │   │   ▼
                  │   └──► Use refreshed token ✅
                  │
                  └─ Not found? ───────► Error: Missing token ❌
```

---

## 2. Sync Flow (Raindrop → Chrome)

### Main Sync Process
```
Alarm triggers (every 10 min) OR Manual sync
         │
         ▼
background.js → performSync()
         │
         ├─ Check isSyncing flag (prevent concurrent syncs)
         ├─ Set isSyncing = true
         ├─ Set suppressLocalBookmarkEvents = true
         └─ Load state from storage
              ├─ lastSync (ISO timestamp)
              ├─ collectionMap (Raindrop ID → Chrome folder ID)
              ├─ groupMap (Group name → Chrome folder ID)
              ├─ itemMap (Raindrop ID → Chrome bookmark ID)
              ├─ rootFolderId
              └─ parentFolderId
         │
         ▼
Ensure root folder exists → ensureRootAndMaybeReset()
         │
         ▼
Fetch Raindrop data → fetchGroupsAndCollections()
         │
         ├─ GET /user → Get groups
         ├─ GET /collections → Get root collections
         └─ GET /collections/childrens → Get child collections
         │
         ▼
Filter out "🐻‍❄️ Projects" group
         │
         ▼
Build collections index → buildCollectionsIndex()
         │
         ▼
Sync folder structure → syncFolders()
         │
         ├─ Create/update group folders
         ├─ Create/update collection folders
         ├─ Maintain hierarchy (parent → child)
         ├─ Remove orphaned folders
         └─ Update collectionMap & groupMap
         │
         ▼
Sync bookmark items → syncNewAndUpdatedItems()
         │
         ├─ GET /raindrops/0?sort=-lastUpdate&perpage=50&page=0...
         │   └─ Fetch items updated since lastSync
         │
         ├─ For each item:
         │   ├─ Check if exists in itemMap
         │   │   ├─ Yes: Update title/URL if changed
         │   │   └─ Move to correct folder if needed
         │   │
         │   └─ No: Create new bookmark
         │       ├─ Determine target folder (from collectionMap)
         │       └─ Create via chrome.bookmarks.create()
         │
         └─ Update itemMap with new mappings
         │
         ▼
Sync deleted items → syncDeletedItems()
         │
         ├─ GET /raindrops/-99 (trash collection)
         │   └─ Fetch items moved to trash since lastSync
         │
         ├─ For each trashed item:
         │   ├─ Find local bookmark ID via itemMap
         │   └─ Delete via chrome.bookmarks.remove()
         │
         └─ Remove from itemMap
         │
         ▼
Save updated state → saveState()
         │
         ├─ lastSync = newLastSyncISO
         ├─ collectionMap
         ├─ itemMap
         └─ groupMap (if changed)
         │
         ▼
Clear badges & notify
         ├─ isSyncing = false
         └─ suppressLocalBookmarkEvents = false
```

### Folder Structure Mapping
```
Raindrop Structure          Chrome Structure
──────────────────          ────────────────
Groups (e.g., "Tech")       └─ Raindrop/
    └─ Collections              └─ Tech/
        └─ Child Collections          └─ Frontend/
                                          └─ React/
                                              └─ Bookmarks
```

**State Maps:**
- `groupMap`: `{"Tech" → "chrome_folder_id_123"}`
- `collectionMap`: `{"collection_id_456" → "chrome_folder_id_789"}`
- `itemMap`: `{"raindrop_id_101" → "chrome_bookmark_id_202"}`

---

## 3. Save to Unsorted Flow

```
User clicks "Save to Unsorted" in popup
         │
         ▼
popup.js → sendCommand('saveCurrentOrHighlightedTabsToRaindrop')
         │
         ▼
background.js → saveCurrentOrHighlightedTabsToRaindrop()
         │
         ├─ Query tabs (highlighted or current)
         ├─ Extract URLs and titles
         └─ Check duplicates → POST /import/url/exists
         │
         ▼
Filter out existing URLs
         │
         ▼
POST /raindrops → Bulk create in Unsorted collection
         │
         ├─ items: [{link, title, collection: {$id: -1}}]
         └─ Returns: {items: [{_id, link, ...}]}
         │
         ▼
Create local bookmarks immediately
         │
         ├─ For each created item:
         │   ├─ Ensure Unsorted folder exists
         │   ├─ Create bookmark via chrome.bookmarks.create()
         │   └─ Map raindrop._id → chrome.bookmark.id
         │
         ├─ Remember URLs → recentlyCreatedRemoteUrls Set
         │   └─ Prevents mirror.js from creating duplicates
         │
         └─ Update itemMap
         │
         ▼
Update state → saveState()
         │
         ▼
Show notification & badge
```

---

## 4. Projects Flow

### Save Project Flow
```
User saves tabs as project
         │
         ▼
popup.js → sendCommand('saveHighlightedTabsAsProject', {name})
         │
         ▼
background.js → saveHighlightedTabsAsProject()
         │
         ├─ Query highlighted tabs
         ├─ Load custom tab titles from storage
         ├─ Query tab groups in window
         └─ Build items array:
            ├─ link: tab.url (or transformed if extension://)
            ├─ title: tab.title
            └─ note: JSON.stringify({
                  index: tab index,
                  pinned: boolean,
                  tabGroup: group name,
                  tabGroupColor: color,
                  customTitle: custom title (if exists)
               })
         │
         ▼
Ensure "🐻‍❄️ Projects" group exists
         │
         ├─ GET /user → Check groups
         └─ If missing: POST /user → Create group
         │
         ▼
POST /collection → Create new collection
         │
         └─ Returns: {item: {_id: collectionId}}
         │
         ▼
Add collection to Projects group
         │
         ├─ GET /user → Get current groups
         ├─ Find Projects group
         ├─ Add collectionId to front of collections array
         └─ PUT /user → Update groups
         │
         ▼
POST /raindrops → Bulk create bookmarks
         │
         └─ items: [{link, title, note, collection: {$id: collectionId}}]
         │
         ▼
Show notification with link to collection
```

### Recover Project Flow
```
User clicks project in popup
         │
         ▼
popup.js → sendCommand('recoverSavedProject', {id, title})
         │
         ▼
background.js → recoverSavedProject()
         │
         ├─ Check if already syncing with a window
         │   └─ If yes: Focus that window & return
         │
         ▼
GET /raindrops/{collectionId}/export.html
         │
         └─ Returns HTML bookmark export format
         │
         ▼
Parse HTML export
         │
         ├─ Extract <DT><A HREF> tags (links)
         ├─ Extract <DD> tags (metadata JSON)
         └─ Parse metadata:
            ├─ index: tab order
            ├─ pinned: boolean
            ├─ tabGroup: group name
            ├─ tabGroupColor: color
            └─ customTitle: custom title
         │
         ▼
Sort by index
         │
         ▼
Create tabs in window
         │
         ├─ Determine target window (current or new)
         ├─ Create tabs via chrome.tabs.create()
         ├─ Set pinned status
         └─ Restore tab groups via chrome.tabs.group()
         │
         ▼
Restore custom titles
         │
         ├─ Load tabTitles from storage
         ├─ Merge with custom titles from metadata
         └─ Save to chrome.storage.local
         │
         ▼
Send message to background → apply_custom_title
         │
         └─ background.js applies titles with retry logic
```

### Live Window Sync Flow
```
User clicks "Save current window as project"
         │
         ▼
popup.js → sendCommand('saveWindowAsProject', {name})
         │
         ▼
background.js → saveWindowAsProject()
         │
         ├─ Create collection (same as save project)
         └─ Start window sync session
            ├─ Store in windowSyncSessions Map:
            │   └─ {windowId → {collectionId, windowId, name}}
            └─ Persist to storage
         │
         ▼
Schedule sync alarm → scheduleWindowSync()
         │
         ├─ Clear existing alarm for window
         └─ Create alarm: "raindrop-window-sync-{windowId}"
            └─ Fires after 1.5s delay
         │
         ▼
Tab/window events trigger rescheduling
         │
         ├─ tab.onCreated → scheduleWindowSync()
         ├─ tab.onRemoved → scheduleWindowSync()
         ├─ tab.onUpdated → scheduleWindowSync()
         └─ tab.onMoved → scheduleWindowSync()
         │
         ▼
Alarm fires → overrideCollectionWithWindowTabs()
         │
         ├─ Query all tabs in window
         ├─ Load custom titles
         ├─ Query tab groups
         └─ Build items array (same format as save project)
         │
         ▼
DELETE /raindrops/{collectionId} → Clear collection
         │
         ▼
POST /raindrops → Replace with current window state
         │
         └─ items: [{link, title, note, collection: {$id}}]
         │
         ▼
Schedule next sync (debounced by 1.5s)
```

---

## 5. Tab Renaming Flow

### Set Custom Title
```
User presses Alt+T or clicks "Rename tab"
         │
         ▼
background.js → requestPromptForTab()
         │
         ├─ Send message to tab: 'get_new_title_prompt'
         └─ tab-title.js (content script) shows prompt()
         │
         ▼
User enters new title
         │
         ▼
content script → sendResponse({newTitle})
         │
         ▼
background.js → processNewTitleResponse()
         │
         ├─ Save to tabTitlesCache[tabId] = {title, url}
         ├─ Save to chrome.storage.local.tabTitles
         └─ Send message to tab: 'set_custom_title'
         │
         ▼
content script intercepts title changes
         │
         ├─ Overrides document.title setter
         └─ Blocks page from changing title
         │
         ▼
Tab lifecycle listeners
         │
         ├─ tab.onUpdated → Apply title with retry
         ├─ tab.onActivated → Re-apply title
         └─ tab.onReplaced → Transfer title to new tab
```

### Restore Custom Titles on Startup
```
Browser startup
         │
         ▼
background.js → onStartup listener
         │
         ├─ Load tabTitles from storage
         └─ Query all current tabs
         │
         ▼
Match tabs by URL
         │
         ├─ For each tab:
         │   ├─ Find matching URL in old tabTitles
         │   ├─ Create new mapping: newTabId → {title, url}
         │   └─ Delete old mapping
         │
         └─ Save updated tabTitles
         │
         ▼
Apply titles with retry logic
         │
         └─ Stagger by 200ms to avoid overwhelming
```

---

## 6. Mirror Flow (Chrome → Raindrop) - Disabled

⚠️ **Note**: The extension has mirroring code (`mirror.js`) but it's not actively used in the current implementation. The sync is **one-way only** (Raindrop → Chrome).

However, if mirroring were enabled, the flow would be:

```
User modifies bookmark in Chrome (under Raindrop folder)
         │
         ▼
chrome.bookmarks.onCreated/onChanged/onRemoved/onMoved
         │
         ▼
Check if under managed root folder
         │
         ├─ No? → Ignore
         └─ Yes? → Continue
         │
         ▼
Check suppressLocalBookmarkEvents flag
         │
         ├─ True? → Ignore (extension-initiated change)
         └─ False? → Continue
         │
         ▼
mirror.js handlers
         │
         ├─ onCreated:
         │   ├─ Bookmark? → POST /raindrop
         │   └─ Folder? → POST /collection
         │
         ├─ onChanged:
         │   ├─ Bookmark? → PUT /raindrop/{id}
         │   └─ Folder? → PUT /collection/{id}
         │
         ├─ onRemoved:
         │   ├─ Bookmark? → DELETE /raindrop/{id}
         │   └─ Folder? → DELETE /collection/{id}
         │
         └─ onMoved:
            ├─ Bookmark? → PUT /raindrop/{id} (update collection)
            └─ Folder? → PUT /collection/{id} (update parent)
```

---

## 7. State Storage

### Local Storage (`chrome.storage.local`)
```javascript
{
  // Sync state
  lastSync: "2024-01-15T10:30:00.000Z",
  collectionMap: {
    "123": "chrome_folder_id_456",  // Raindrop ID → Chrome folder ID
    "789": "chrome_folder_id_012"
  },
  groupMap: {
    "Tech": "chrome_folder_id_345",  // Group name → Chrome folder ID
    "Personal": "chrome_folder_id_678"
  },
  itemMap: {
    "raindrop_101": "chrome_bookmark_202",  // Raindrop ID → Chrome bookmark ID
    "raindrop_303": "chrome_bookmark_404"
  },
  rootFolderId: "chrome_folder_id_root",
  parentFolderId: "chrome_folder_id_parent",
  
  // Authentication
  raindropApiToken: "test_token_here",  // Optional test token
  
  // UI preferences
  notifyOnSync: true,
  
  // Tab titles
  tabTitles: {
    "123": {title: "Custom Title", url: "https://example.com"},
    "456": {title: "Another Title", url: "https://other.com"}
  },
  
  // Projects cache
  cached-projects-list: [{id, title, count, lastUpdate, cover}, ...],
  
  // Window sync sessions
  activeWindowSyncSessions: {
    "window_789": {collectionId: 123, name: "Project Name"}
  }
}
```

### Sync Storage (`chrome.storage.sync`)
```javascript
{
  // OAuth tokens (sync across devices)
  oauthAccessToken: "bearer_token_here",
  oauthRefreshToken: "refresh_token_here",
  oauthExpiresAt: 1705318800000  // Timestamp in milliseconds
}
```

---

## 8. API Request Flow

### Request Pipeline
```
Module calls api-facade.js function
         │
         ▼
api-facade.js → ensureToken()
         │
         ├─ loadTokenIfNeeded() → raindrop.js
         │   │
         │   ├─ getActiveToken()
         │   │   ├─ Check local: raindropApiToken
         │   │   ├─ Check sync: oauthAccessToken
         │   │   ├─ Check expiry
         │   │   └─ Refresh if needed
         │   │
         │   └─ Return token
         │
         ▼
raindrop.js → apiGET/apiPOST/etc.
         │
         ├─ Build URL: https://api.raindrop.io/rest/v1{path}
         ├─ Set headers: Authorization: Bearer {token}
         └─ fetchWithRetry()
            │
            ├─ Fetch with retry logic
            ├─ Handle 429 (rate limit)
            │   └─ Exponential backoff
            └─ Return response
         │
         ▼
Check response status
         │
         ├─ 401/403? → notifyMissingOrInvalidToken()
         └─ Otherwise → Return JSON response
```

---

## 9. Error Handling Flow

```
API Request fails
         │
         ▼
Check error status
         │
         ├─ 429 (Rate Limit)?
         │   └─ Retry with exponential backoff (up to 5 times)
         │
         ├─ 401/403 (Auth)?
         │   ├─ Notify user
         │   └─ Throw error
         │
         └─ Other error?
            ├─ Log to console
            ├─ Show notification (if enabled)
            └─ Continue gracefully (don't crash)
```

---

## 10. Content Script Communication

```
Background ↔ Content Script (tab-title.js)
         │
         ▼
Message Types:
         │
         ├─ 'check_custom_title'
         │   └─ Background checks cache, returns {hasCustomTitle, title}
         │
         ├─ 'get_new_title_prompt'
         │   └─ Content script shows prompt(), returns {newTitle}
         │
         ├─ 'set_custom_title'
         │   └─ Background sends {title}, content script sets it
         │
         └─ 'remove_custom_title'
            └─ Background requests removal, content script restores original
```

---

## Key Design Patterns

1. **State Management**: Centralized state in `chrome.storage.local`
2. **Idempotency**: Operations can be safely retried
3. **Debouncing**: Window sync uses alarms to debounce rapid changes
4. **Suppression Flags**: Prevent circular updates (suppressLocalBookmarkEvents)
5. **Caching**: Projects list cached locally for fast popup loading
6. **Retry Logic**: API calls retry on rate limits
7. **Token Refresh**: Automatic OAuth token refresh before expiry
8. **URL Tracking**: Track recently created URLs to prevent duplicate creation

