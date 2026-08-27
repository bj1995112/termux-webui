/** IndexedDB / LocalStorage hybrid persistent translation cache */

const DB_NAME = 'twui_translations_db';
const STORE_NAME = 'translations';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase | null> | null = null;

function getDB(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'key' });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }
  return dbPromise;
}

export async function getCachedTranslation(text: string, toLang = 'zh-CN'): Promise<string | null> {
  const clean = text.trim();
  if (!clean) return null;
  const key = `${toLang}:${clean}`;

  // 1. Try IndexedDB
  try {
    const db = await getDB();
    if (db) {
      return await new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result?.translated || null);
        req.onerror = () => resolve(null);
      });
    }
  } catch {
    /* fallback to localStorage */
  }

  // 2. Try LocalStorage
  try {
    const item = localStorage.getItem(`twui.tr.${key.slice(0, 80)}`);
    return item;
  } catch {
    return null;
  }
}

export async function setCachedTranslation(text: string, translated: string, toLang = 'zh-CN') {
  const clean = text.trim();
  if (!clean || !translated) return;
  const key = `${toLang}:${clean}`;

  // 1. Write IndexedDB
  try {
    const db = await getDB();
    if (db) {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put({ key, translated, timestamp: Date.now() });
    }
  } catch {
    /* fallback */
  }

  // 2. Write LocalStorage (cap items)
  try {
    localStorage.setItem(`twui.tr.${key.slice(0, 80)}`, translated);
  } catch {
    /* ignore quota full */
  }
}
