import { getDB, saveDB, query, execAndSave, generateGUID, SqlParams } from './sqlite';
import { setQuestionTags, getQuestionTags, type Tag } from './tags';

export interface SingleAnswerQuestion {
  questionId: string;
  questionText: string;
  correctAnswer: string;
  caseSensitive: boolean;
  allowPartialMatch: boolean;
  tags: Tag[];
  difficulty: number;
  createdAt: number;
  updatedAt: number;
}

export async function createSingleAnswerQuestion(data: {
  questionText: string;
  correctAnswer: string;
  caseSensitive?: boolean;
  allowPartialMatch?: boolean;
  tags?: string[];
  difficulty?: number;
}): Promise<string> {
  const questionId = generateGUID();
  const questionType = 'single_answer';
  const now = Date.now();

  const db = getDB();

  // Insert into questions table
  db.run(
    `INSERT INTO questions (question_id, question_type, difficulty, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    [questionId, questionType, data.difficulty || 1, now, now]
  );

  // Insert into single_answer_questions table
  db.run(
    `INSERT INTO single_answer_questions (question_id, question_type, question_text)
     VALUES (?, ?, ?)`,
    [questionId, questionType, data.questionText]
  );

  // Insert into single_answer_config table
  db.run(
    `INSERT INTO single_answer_config (question_id, question_type, correct_answer, case_sensitive, allow_partial_match)
     VALUES (?, ?, ?, ?, ?)`,
    [questionId, questionType, data.correctAnswer, data.caseSensitive ? 1 : 0, data.allowPartialMatch ? 1 : 0]
  );

  await saveDB();

  // Set tags if provided
  if (data.tags && data.tags.length > 0) {
    await setQuestionTags(questionId, questionType, data.tags);
  }

  return questionId;
}

export function getSingleAnswerQuestion(questionId: string): SingleAnswerQuestion | null {
  const results = query(
    `SELECT
      q.question_id as questionId,
      saq.question_text as questionText,
      sac.correct_answer as correctAnswer,
      sac.case_sensitive as caseSensitive,
      sac.allow_partial_match as allowPartialMatch,
      q.difficulty,
      q.created_at as createdAt,
      q.updated_at as updatedAt
     FROM questions q
     JOIN single_answer_questions saq ON q.question_id = saq.question_id AND q.question_type = saq.question_type
     JOIN single_answer_config sac ON q.question_id = sac.question_id AND q.question_type = sac.question_type
     WHERE q.question_id = ? AND q.question_type = 'single_answer'`,
    [questionId]
  );

  if (results.length === 0) return null;

  const result = results[0];
  const tags = getQuestionTags(questionId, 'single_answer');

  return {
    ...result,
    caseSensitive: Boolean(result.caseSensitive),
    allowPartialMatch: Boolean(result.allowPartialMatch),
    tags
  };
}

export function getAllSingleAnswerQuestions(): SingleAnswerQuestion[] {
  const results = query(
    `SELECT
      q.question_id as questionId,
      saq.question_text as questionText,
      sac.correct_answer as correctAnswer,
      sac.case_sensitive as caseSensitive,
      sac.allow_partial_match as allowPartialMatch,
      q.difficulty,
      q.created_at as createdAt,
      q.updated_at as updatedAt
     FROM questions q
     JOIN single_answer_questions saq ON q.question_id = saq.question_id AND q.question_type = saq.question_type
     JOIN single_answer_config sac ON q.question_id = sac.question_id AND q.question_type = sac.question_type
     WHERE q.question_type = 'single_answer'
     ORDER BY q.created_at DESC`
  );

  return results.map(result => {
    const tags = getQuestionTags(result.questionId, 'single_answer');
    return {
      ...result,
      caseSensitive: Boolean(result.caseSensitive),
      allowPartialMatch: Boolean(result.allowPartialMatch),
      tags
    };
  });
}

export async function updateSingleAnswerQuestion(questionId: string, data: {
  questionText?: string;
  correctAnswer?: string;
  caseSensitive?: boolean;
  allowPartialMatch?: boolean;
  tags?: string[];
  difficulty?: number;
}): Promise<void> {
  const db = getDB();
  const now = Date.now();

  // Update questions table if relevant fields are provided
  if (data.difficulty !== undefined) {
    db.run(
      `UPDATE questions SET difficulty = ?, updated_at = ? WHERE question_id = ? AND question_type = ?`,
      [data.difficulty, now, questionId, 'single_answer']
    );
  } else {
    db.run(
      `UPDATE questions SET updated_at = ? WHERE question_id = ? AND question_type = ?`,
      [now, questionId, 'single_answer']
    );
  }

  // Update single_answer_questions table
  if (data.questionText !== undefined) {
    db.run(
      `UPDATE single_answer_questions SET question_text = ? WHERE question_id = ? AND question_type = ?`,
      [data.questionText, questionId, 'single_answer']
    );
  }

  // Update single_answer_config table
  if (data.correctAnswer !== undefined || data.caseSensitive !== undefined || data.allowPartialMatch !== undefined) {
    const updates: string[] = [];
    const params: SqlParams = [];

    if (data.correctAnswer !== undefined) {
      updates.push('correct_answer = ?');
      params.push(data.correctAnswer);
    }
    if (data.caseSensitive !== undefined) {
      updates.push('case_sensitive = ?');
      params.push(data.caseSensitive ? 1 : 0);
    }
    if (data.allowPartialMatch !== undefined) {
      updates.push('allow_partial_match = ?');
      params.push(data.allowPartialMatch ? 1 : 0);
    }

    params.push(questionId, 'single_answer');
    db.run(
      `UPDATE single_answer_config SET ${updates.join(', ')} WHERE question_id = ? AND question_type = ?`,
      params
    );
  }

  await saveDB();

  // Update tags if provided
  if (data.tags !== undefined) {
    await setQuestionTags(questionId, 'single_answer', data.tags);
  }
}

export async function deleteSingleAnswerQuestion(questionId: string): Promise<void> {
  await execAndSave(
    `DELETE FROM questions WHERE question_id = ? AND question_type = ?`,
    [questionId, 'single_answer']
  );
}
