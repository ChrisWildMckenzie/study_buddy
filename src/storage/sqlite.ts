import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import { saveSQLiteData, loadSQLiteData } from './indexeddb';

// SQL parameter types that SQLite accepts
export type SqlValue = string | number | null | Uint8Array;
export type SqlParams = SqlValue[];

let SQL: SqlJsStatic | null = null;
let db: Database | null = null;

const LEGACY_DB_KEY = 'study-buddy-sqlite-db';

export async function initSQLite(): Promise<Database> {
  if (db) return db;

  // Initialize SQL.js
  if (!SQL) {
    SQL = await initSqlJs({
      locateFile: (file: string) => `https://sql.js.org/dist/${file}`
    });
  }

  // Migrate from localStorage to IndexedDB if legacy data exists
  const legacyDB = localStorage.getItem(LEGACY_DB_KEY);
  if (legacyDB) {
    const buffer = Uint8Array.from(atob(legacyDB), c => c.charCodeAt(0));
    await saveSQLiteData(buffer);
    localStorage.removeItem(LEGACY_DB_KEY);
  }

  // Try to load existing database from IndexedDB
  const savedDB = await loadSQLiteData();
  if (savedDB) {
    db = new SQL.Database(savedDB);
  } else {
    // Create new database
    db = new SQL.Database();

    // Initialize schema
    db.run(`
      CREATE TABLE IF NOT EXISTS study_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subject TEXT NOT NULL,
        duration INTEGER NOT NULL,
        notes TEXT,
        created_at INTEGER NOT NULL
      );
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS flashcards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        category TEXT,
        difficulty INTEGER DEFAULT 1,
        next_review INTEGER,
        review_count INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL
      );
    `);

    // Question types lookup table
    db.run(`
      CREATE TABLE IF NOT EXISTS question_types (
        type_code TEXT PRIMARY KEY,
        description TEXT NOT NULL
      );
    `);

    db.run(`
      INSERT OR IGNORE INTO question_types (type_code, description) VALUES
        ('single_answer', 'Single correct one-word or short answer'),
        ('multi_choice', 'Multiple choice question with one or more correct answers');
    `);

    // Core questions table - minimal essential data only
    db.run(`
      CREATE TABLE IF NOT EXISTS questions (
        question_id TEXT NOT NULL,
        question_type TEXT NOT NULL,
        difficulty INTEGER DEFAULT 1 CHECK(difficulty BETWEEN 1 AND 5),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (question_id, question_type),
        FOREIGN KEY (question_type) REFERENCES question_types(type_code)
      );
    `);

    // Tags table - user-defined tags for organizing questions
    db.run(`
      CREATE TABLE IF NOT EXISTS tags (
        tag_id TEXT PRIMARY KEY,
        tag_name TEXT NOT NULL UNIQUE,
        created_at INTEGER NOT NULL
      );
    `);

    // Question-tags linking table - many-to-many relationship
    db.run(`
      CREATE TABLE IF NOT EXISTS question_tags (
        question_id TEXT NOT NULL,
        question_type TEXT NOT NULL,
        tag_id TEXT NOT NULL,
        PRIMARY KEY (question_id, question_type, tag_id),
        FOREIGN KEY (question_id, question_type) REFERENCES questions(question_id, question_type) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags(tag_id) ON DELETE CASCADE
      );
    `);

    db.run(`
      CREATE INDEX IF NOT EXISTS idx_question_tags_question
      ON question_tags(question_id, question_type);
    `);

    db.run(`
      CREATE INDEX IF NOT EXISTS idx_question_tags_tag
      ON question_tags(tag_id);
    `);

    // Single answer questions - parallel structure for this question type
    db.run(`
      CREATE TABLE IF NOT EXISTS single_answer_questions (
        question_id TEXT NOT NULL,
        question_type TEXT NOT NULL DEFAULT 'single_answer',
        question_text TEXT NOT NULL,
        PRIMARY KEY (question_id, question_type),
        FOREIGN KEY (question_id, question_type) REFERENCES questions(question_id, question_type) ON DELETE CASCADE,
        FOREIGN KEY (question_type) REFERENCES question_types(type_code),
        CHECK (question_type = 'single_answer')
      );
    `);

    // Single answer configuration - what constitutes a correct answer
    db.run(`
      CREATE TABLE IF NOT EXISTS single_answer_config (
        question_id TEXT NOT NULL,
        question_type TEXT NOT NULL DEFAULT 'single_answer',
        correct_answer TEXT NOT NULL,
        case_sensitive INTEGER DEFAULT 0,
        allow_partial_match INTEGER DEFAULT 0,
        PRIMARY KEY (question_id, question_type),
        FOREIGN KEY (question_id, question_type) REFERENCES questions(question_id, question_type) ON DELETE CASCADE,
        FOREIGN KEY (question_type) REFERENCES question_types(type_code),
        CHECK (question_type = 'single_answer')
      );
    `);

    // Multi-choice questions - parallel structure for this question type
    db.run(`
      CREATE TABLE IF NOT EXISTS multi_choice_questions (
        question_id TEXT NOT NULL,
        question_type TEXT NOT NULL DEFAULT 'multi_choice',
        question_text TEXT NOT NULL,
        shuffle_options INTEGER DEFAULT 0,
        allow_multiple_selection INTEGER DEFAULT 0,
        PRIMARY KEY (question_id, question_type),
        FOREIGN KEY (question_id, question_type) REFERENCES questions(question_id, question_type) ON DELETE CASCADE,
        FOREIGN KEY (question_type) REFERENCES question_types(type_code),
        CHECK (question_type = 'multi_choice')
      );
    `);

    // Multi-choice options - one-to-many relationship with questions
    db.run(`
      CREATE TABLE IF NOT EXISTS multi_choice_options (
        option_id TEXT PRIMARY KEY,
        question_id TEXT NOT NULL,
        question_type TEXT NOT NULL DEFAULT 'multi_choice',
        option_text TEXT NOT NULL,
        is_correct INTEGER NOT NULL DEFAULT 0,
        display_order INTEGER NOT NULL,
        FOREIGN KEY (question_id, question_type) REFERENCES multi_choice_questions(question_id, question_type) ON DELETE CASCADE,
        CHECK (question_type = 'multi_choice')
      );
    `);

    db.run(`
      CREATE INDEX IF NOT EXISTS idx_multi_choice_options_question
      ON multi_choice_options(question_id, question_type);
    `);
  }

  return db;
}

export function getDB(): Database {
  if (!db) {
    throw new Error('Database not initialized. Call initSQLite() first.');
  }
  return db;
}

// Save database to IndexedDB
export async function saveDB(): Promise<void> {
  if (!db) return;

  const buffer = db.export();
  await saveSQLiteData(buffer);
}

// Export database as file
export function exportDB(): Uint8Array {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db.export();
}

// Import database from file
export async function importDB(data: Uint8Array): Promise<void> {
  if (!SQL) {
    SQL = await initSqlJs({
      locateFile: (file: string) => `https://sql.js.org/dist/${file}`
    });
  }

  db = new SQL.Database(data);
  await saveDB();
}

// Execute query with auto-save
export async function execAndSave(sql: string, params?: SqlParams): Promise<void> {
  const database = getDB();
  database.run(sql, params);
  await saveDB();
}

// Query helper - returns array of row objects
// Uses any internally since SQL results are dynamically shaped
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function query<T = any>(sql: string, params?: SqlParams): T[] {
  const database = getDB();
  const results = database.exec(sql, params);

  if (results.length === 0) return [];

  const { columns, values } = results[0];
  return values.map(row => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const obj: Record<string, any> = {};
    columns.forEach((col, idx) => {
      obj[col] = row[idx];
    });
    return obj as T;
  });
}

// Generate a GUID for use as primary key
export function generateGUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
