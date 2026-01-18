import { getDB, saveDB, query, execAndSave, generateGUID } from './sqlite';
import { setQuestionTags, getQuestionTags, type Tag } from './tags';

export interface MultiChoiceOption {
  optionId: string;
  optionText: string;
  isCorrect: boolean;
  displayOrder: number;
}

export interface MultiChoiceQuestion {
  questionId: string;
  questionText: string;
  shuffleOptions: boolean;
  allowMultipleSelection: boolean;
  options: MultiChoiceOption[];
  tags: Tag[];
  difficulty: number;
  createdAt: number;
  updatedAt: number;
}

export interface MultiChoiceQuestionData {
  questionText: string;
  options: { optionText: string; isCorrect: boolean }[];
  shuffleOptions?: boolean;
  allowMultipleSelection?: boolean;
  tags?: string[];
  difficulty?: number;
}

function validateOptions(options: { optionText: string; isCorrect: boolean }[], allowMultiple: boolean): void {
  if (options.length < 2) {
    throw new Error('At least 2 options are required');
  }

  const correctCount = options.filter(o => o.isCorrect).length;
  if (correctCount === 0) {
    throw new Error('At least one option must be marked as correct');
  }

  if (!allowMultiple && correctCount !== 1) {
    throw new Error('Single selection mode requires exactly one correct answer');
  }
}

export async function createMultiChoiceQuestion(data: MultiChoiceQuestionData): Promise<string> {
  validateOptions(data.options, data.allowMultipleSelection ?? false);

  const questionId = generateGUID();
  const questionType = 'multi_choice';
  const now = Date.now();

  const db = getDB();

  db.run(
    `INSERT INTO questions (question_id, question_type, difficulty, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    [questionId, questionType, data.difficulty || 1, now, now]
  );

  db.run(
    `INSERT INTO multi_choice_questions (question_id, question_type, question_text, shuffle_options, allow_multiple_selection)
     VALUES (?, ?, ?, ?, ?)`,
    [questionId, questionType, data.questionText, data.shuffleOptions ? 1 : 0, data.allowMultipleSelection ? 1 : 0]
  );

  data.options.forEach((option, index) => {
    db.run(
      `INSERT INTO multi_choice_options (option_id, question_id, question_type, option_text, is_correct, display_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [generateGUID(), questionId, questionType, option.optionText, option.isCorrect ? 1 : 0, index]
    );
  });

  await saveDB();

  if (data.tags && data.tags.length > 0) {
    await setQuestionTags(questionId, questionType, data.tags);
  }

  return questionId;
}

export function getMultiChoiceQuestion(questionId: string): MultiChoiceQuestion | null {
  const results = query(
    `SELECT
      q.question_id as questionId,
      mcq.question_text as questionText,
      mcq.shuffle_options as shuffleOptions,
      mcq.allow_multiple_selection as allowMultipleSelection,
      q.difficulty,
      q.created_at as createdAt,
      q.updated_at as updatedAt
     FROM questions q
     JOIN multi_choice_questions mcq ON q.question_id = mcq.question_id AND q.question_type = mcq.question_type
     WHERE q.question_id = ? AND q.question_type = 'multi_choice'`,
    [questionId]
  );

  if (results.length === 0) return null;

  const result = results[0];
  const options = query(
    `SELECT option_id as optionId, option_text as optionText, is_correct as isCorrect, display_order as displayOrder
     FROM multi_choice_options
     WHERE question_id = ? AND question_type = 'multi_choice'
     ORDER BY display_order`,
    [questionId]
  ).map(opt => ({ ...opt, isCorrect: Boolean(opt.isCorrect) }));

  const tags = getQuestionTags(questionId, 'multi_choice');

  return {
    ...result,
    shuffleOptions: Boolean(result.shuffleOptions),
    allowMultipleSelection: Boolean(result.allowMultipleSelection),
    options,
    tags
  };
}

export function getAllMultiChoiceQuestions(): MultiChoiceQuestion[] {
  const results = query(
    `SELECT
      q.question_id as questionId,
      mcq.question_text as questionText,
      mcq.shuffle_options as shuffleOptions,
      mcq.allow_multiple_selection as allowMultipleSelection,
      q.difficulty,
      q.created_at as createdAt,
      q.updated_at as updatedAt
     FROM questions q
     JOIN multi_choice_questions mcq ON q.question_id = mcq.question_id AND q.question_type = mcq.question_type
     WHERE q.question_type = 'multi_choice'
     ORDER BY q.created_at DESC`
  );

  return results.map(result => {
    const options = query(
      `SELECT option_id as optionId, option_text as optionText, is_correct as isCorrect, display_order as displayOrder
       FROM multi_choice_options
       WHERE question_id = ? AND question_type = 'multi_choice'
       ORDER BY display_order`,
      [result.questionId]
    ).map(opt => ({ ...opt, isCorrect: Boolean(opt.isCorrect) }));

    const tags = getQuestionTags(result.questionId, 'multi_choice');

    return {
      ...result,
      shuffleOptions: Boolean(result.shuffleOptions),
      allowMultipleSelection: Boolean(result.allowMultipleSelection),
      options,
      tags
    };
  });
}

export async function updateMultiChoiceQuestion(questionId: string, data: MultiChoiceQuestionData): Promise<void> {
  validateOptions(data.options, data.allowMultipleSelection ?? false);

  const db = getDB();
  const now = Date.now();

  db.run(
    `UPDATE questions SET difficulty = ?, updated_at = ? WHERE question_id = ? AND question_type = ?`,
    [data.difficulty || 1, now, questionId, 'multi_choice']
  );

  db.run(
    `UPDATE multi_choice_questions SET question_text = ?, shuffle_options = ?, allow_multiple_selection = ?
     WHERE question_id = ? AND question_type = ?`,
    [data.questionText, data.shuffleOptions ? 1 : 0, data.allowMultipleSelection ? 1 : 0, questionId, 'multi_choice']
  );

  // Replace all options
  db.run(`DELETE FROM multi_choice_options WHERE question_id = ? AND question_type = ?`, [questionId, 'multi_choice']);

  data.options.forEach((option, index) => {
    db.run(
      `INSERT INTO multi_choice_options (option_id, question_id, question_type, option_text, is_correct, display_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [generateGUID(), questionId, 'multi_choice', option.optionText, option.isCorrect ? 1 : 0, index]
    );
  });

  await saveDB();

  await setQuestionTags(questionId, 'multi_choice', data.tags || []);
}

export async function deleteMultiChoiceQuestion(questionId: string): Promise<void> {
  await execAndSave(
    `DELETE FROM questions WHERE question_id = ? AND question_type = ?`,
    [questionId, 'multi_choice']
  );
}
