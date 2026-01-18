import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface StudyBuddyDB extends DBSchema {
  notes: {
    key: string;
    value: {
      id: string;
      title: string;
      content: string;
      createdAt: number;
      updatedAt: number;
    };
    indexes: { 'by-date': number };
  };
  sqliteData: {
    key: string;
    value: Uint8Array;
  };
}

let dbInstance: IDBPDatabase<StudyBuddyDB> | null = null;

export async function initDB(): Promise<IDBPDatabase<StudyBuddyDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<StudyBuddyDB>('study-buddy-db', 2, {
    upgrade(db) {
      // Create notes store
      if (!db.objectStoreNames.contains('notes')) {
        const notesStore = db.createObjectStore('notes', { keyPath: 'id' });
        notesStore.createIndex('by-date', 'updatedAt');
      }

      // Create SQLite data store (v2)
      if (!db.objectStoreNames.contains('sqliteData')) {
        db.createObjectStore('sqliteData');
      }
    },
  });

  return dbInstance;
}

export async function getDB(): Promise<IDBPDatabase<StudyBuddyDB>> {
  if (!dbInstance) {
    return initDB();
  }
  return dbInstance;
}

// Helper functions for common operations
export async function saveNote(note: StudyBuddyDB['notes']['value']) {
  const db = await getDB();
  await db.put('notes', note);
}

export async function getNote(id: string) {
  const db = await getDB();
  return db.get('notes', id);
}

export async function getAllNotes() {
  const db = await getDB();
  return db.getAllFromIndex('notes', 'by-date');
}

export async function deleteNote(id: string) {
  const db = await getDB();
  await db.delete('notes', id);
}

// SQLite data storage helpers
export async function saveSQLiteData(data: Uint8Array): Promise<void> {
  const db = await getDB();
  await db.put('sqliteData', data, 'main');
}

export async function loadSQLiteData(): Promise<Uint8Array | undefined> {
  const db = await getDB();
  return db.get('sqliteData', 'main');
}
