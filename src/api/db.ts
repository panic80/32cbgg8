/**
 * IndexedDB utility functions for managing client-side database operations.
 * Provides a simplified interface for common IndexedDB operations.
 */

type UpgradeCallback = (db: IDBDatabase) => void;

/**
 * Initialize IndexedDB database with version management
 */
export const initDB = (
  dbName: string,
  version: number,
  upgradeCallback: UpgradeCallback,
): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, version);

    request.onerror = () => {
      console.error('IndexedDB error:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      const db = request.result;
      db.onerror = (event) => {
        console.error('Database error:', (event.target as IDBRequest).error);
      };
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      try {
        upgradeCallback(db);
      } catch (error) {
        console.error('Error during database upgrade:', error);
        throw error;
      }
    };

    request.onblocked = () => {
      console.warn('Database upgrade blocked. Please close other tabs and refresh.');
    };
  });
};

/**
 * Add data to a specified store
 */
export const addToStore = async <T>(
  db: IDBDatabase,
  storeName: string,
  data: T,
): Promise<IDBValidKey> => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);

    transaction.onerror = () => {
      console.error(`Error in transaction for ${storeName}:`, transaction.error);
      reject(transaction.error);
    };

    try {
      const request = store.add(data);

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        console.error(`Error adding data to ${storeName}:`, request.error);
        reject(request.error);
      };
    } catch (error) {
      console.error(`Exception while adding data to ${storeName}:`, error);
      reject(error);
    }
  });
};

/**
 * Get all data from a specified store
 */
export const getAllFromStore = async <T>(
  db: IDBDatabase,
  storeName: string,
): Promise<T[]> => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);

    transaction.onerror = () => {
      console.error(`Error in read transaction for ${storeName}:`, transaction.error);
      reject(transaction.error);
    };

    try {
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result as T[]);
      };

      request.onerror = () => {
        console.error(`Error getting data from ${storeName}:`, request.error);
        reject(request.error);
      };
    } catch (error) {
      console.error(`Exception while getting data from ${storeName}:`, error);
      reject(error);
    }
  });
};

/**
 * Update data in a specified store
 */
export const updateInStore = async <T>(
  db: IDBDatabase,
  storeName: string,
  key: IDBValidKey,
  data: T,
): Promise<IDBValidKey> => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(data, key);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

/**
 * Delete data from a specified store
 */
export const deleteFromStore = async (
  db: IDBDatabase,
  storeName: string,
  key: IDBValidKey,
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(key);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

/**
 * Clear all data from a specified store
 */
export const clearStore = async (db: IDBDatabase, storeName: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};
