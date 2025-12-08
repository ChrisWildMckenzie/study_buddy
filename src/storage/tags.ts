import { getDB, saveDB, query, execAndSave, generateGUID } from './sqlite';

export interface Tag {
  tagId: string;
  tagName: string;
  createdAt: number;
}

// Get or create a tag by name
export async function getOrCreateTag(tagName: string): Promise<string> {
  const trimmedName = tagName.trim();
  if (!trimmedName) {
    throw new Error('Tag name cannot be empty');
  }

  // Check if tag already exists
  const existing = query(
    'SELECT tag_id as tagId FROM tags WHERE tag_name = ?',
    [trimmedName]
  );

  if (existing.length > 0) {
    return existing[0].tagId;
  }

  // Create new tag
  const tagId = generateGUID();
  const now = Date.now();

  await execAndSave(
    'INSERT INTO tags (tag_id, tag_name, created_at) VALUES (?, ?, ?)',
    [tagId, trimmedName, now]
  );

  return tagId;
}

// Get all tags
export function getAllTags(): Tag[] {
  return query(`
    SELECT tag_id as tagId, tag_name as tagName, created_at as createdAt
    FROM tags
    ORDER BY tag_name
  `);
}

// Get tags for a specific question
export function getQuestionTags(questionId: string, questionType: string): Tag[] {
  return query(`
    SELECT t.tag_id as tagId, t.tag_name as tagName, t.created_at as createdAt
    FROM tags t
    JOIN question_tags qt ON t.tag_id = qt.tag_id
    WHERE qt.question_id = ? AND qt.question_type = ?
    ORDER BY t.tag_name
  `, [questionId, questionType]);
}

// Set tags for a question (replaces existing tags)
export async function setQuestionTags(questionId: string, questionType: string, tagNames: string[]): Promise<void> {
  const db = getDB();

  // Remove existing tags for this question
  db.run(
    'DELETE FROM question_tags WHERE question_id = ? AND question_type = ?',
    [questionId, questionType]
  );

  // Add new tags
  for (const tagName of tagNames) {
    if (!tagName.trim()) continue;

    const tagId = await getOrCreateTag(tagName);
    db.run(
      'INSERT INTO question_tags (question_id, question_type, tag_id) VALUES (?, ?, ?)',
      [questionId, questionType, tagId]
    );
  }

  await saveDB();
}

// Add a single tag to a question
export async function addQuestionTag(questionId: string, questionType: string, tagName: string): Promise<void> {
  const tagId = await getOrCreateTag(tagName);

  await execAndSave(
    'INSERT OR IGNORE INTO question_tags (question_id, question_type, tag_id) VALUES (?, ?, ?)',
    [questionId, questionType, tagId]
  );
}

// Remove a tag from a question
export async function removeQuestionTag(questionId: string, questionType: string, tagName: string): Promise<void> {
  await execAndSave(`
    DELETE FROM question_tags
    WHERE question_id = ? AND question_type = ?
      AND tag_id = (SELECT tag_id FROM tags WHERE tag_name = ?)
  `, [questionId, questionType, tagName]);
}

// Delete unused tags (tags not associated with any questions)
export async function deleteUnusedTags(): Promise<void> {
  await execAndSave(`
    DELETE FROM tags
    WHERE tag_id NOT IN (SELECT DISTINCT tag_id FROM question_tags)
  `);
}
