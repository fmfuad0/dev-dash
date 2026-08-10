import api from '../api/client.js';

/**
 * Imports the JSON string containing databases back into the browser's IndexedDB natively.
 * Also restores localStorage.
 */
export async function importVsCodeState(stateData) {
  if (!stateData) return;
  
  try {
    const idbData = stateData;
    const lsData = stateData._localStorage || {};
    
    // Restore LocalStorage
    for (const [key, value] of Object.entries(lsData)) {
      localStorage.setItem(key, value);
    }
    
    // Restore IndexedDB
    for (const dbName of Object.keys(idbData)) {
      if (dbName === '_localStorage') continue;
      
      const dbEntry = idbData[dbName];
      let version = 1;
      let dbExport = dbEntry;
      
      // Support the new format with versioning
      if (dbEntry && typeof dbEntry.version === 'number' && dbEntry.data) {
        version = dbEntry.version;
        dbExport = dbEntry.data;
      }
      
      // Delete existing to start fresh and avoid conflicts
      await new Promise((resolve) => {
        const req = indexedDB.deleteDatabase(dbName);
        req.onsuccess = resolve;
        req.onerror = resolve;
      });

      // Import the database
      await importDatabase(dbName, version, dbExport);
    }
    console.log('✅ VS Code IndexedDB perfectly synced from Desktop state!');
  } catch (err) {
    console.error('Failed to import VS Code state:', err);
  }
}

function importDatabase(dbName, version, dbExport) {
  return new Promise((resolve, reject) => {
    const storeNames = Object.keys(dbExport);
    if (storeNames.length === 0) return resolve();

    // Use the actual exported version to prevent VS Code from triggering destructive upgrades
    const request = indexedDB.open(dbName, version);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      storeNames.forEach((storeName) => {
        if (!db.objectStoreNames.contains(storeName)) {
          // VS Code web usually stores data in object stores without key paths (out-of-line keys)
          db.createObjectStore(storeName);
        }
      });
    };

    request.onerror = () => reject(request.error);
    
    request.onsuccess = (event) => {
      const db = event.target.result;
      const transaction = db.transaction(storeNames, 'readwrite');
      
      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);

      storeNames.forEach((storeName) => {
        const store = transaction.objectStore(storeName);
        const records = dbExport[storeName] || [];
        records.forEach((record) => {
          store.put(record.value, record.key);
        });
      });
    };
  });
}

/**
 * Sync routine: Fetch from Local State API, push to IndexedDB.
 */
export async function loadStateFromDesktop() {
  try {
    // Check if we already have local data
    const dbs = await indexedDB.databases();
    const hasLocalState = dbs.some(db => db.name.startsWith('vscode'));

    if (hasLocalState) {
      console.log('✅ Local VS Code state found. Skipping Desktop restore to prevent overwriting recent web changes.');
      return;
    }

    const res = await api.get('/api/vscode/local-state');
    if (res.data && res.data.stateData) {
      await importVsCodeState(res.data.stateData);
    }
  } catch (err) {
    console.error('Failed to sync VS Code state from Desktop', err);
  }
}
