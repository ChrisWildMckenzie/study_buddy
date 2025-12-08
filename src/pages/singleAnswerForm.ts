import { navigate } from '../router';
import {
  createSingleAnswerQuestion,
  getSingleAnswerQuestion,
  updateSingleAnswerQuestion,
  type SingleAnswerQuestion
} from '../storage/singleAnswerQuestions';
import { TagSelector } from '../components/tagSelector';

let tagSelector: TagSelector | null = null;

export function renderSingleAnswerFormPage(questionId?: string): void {
  const app = document.getElementById('app');
  if (!app) return;

  // Load existing question if editing
  let existingQuestion: SingleAnswerQuestion | null = null;
  if (questionId) {
    existingQuestion = getSingleAnswerQuestion(questionId);
    if (!existingQuestion) {
      alert('Question not found');
      navigate('/questions/single_answer');
      return;
    }
  }

  const isEditing = !!existingQuestion;
  const title = isEditing ? 'Edit Question' : 'Add New Question';
  const initialTags = existingQuestion?.tags.map(t => t.tagName) || [];

  app.innerHTML = `
    <div class="container">
      <div class="page-header">
        <a href="#/questions/single_answer" class="back-link">&larr; Back to Questions</a>
        <h1>${title}</h1>
      </div>

      <form id="question-form" class="question-form">
        <div class="form-group">
          <label for="question-text">Question Text *</label>
          <textarea
            id="question-text"
            name="questionText"
            required
            rows="3"
            placeholder="Enter your question here..."
          >${existingQuestion?.questionText || ''}</textarea>
        </div>

        <div class="form-group">
          <label for="correct-answer">Correct Answer *</label>
          <input
            type="text"
            id="correct-answer"
            name="correctAnswer"
            required
            placeholder="Enter the correct answer"
            value="${existingQuestion?.correctAnswer || ''}"
          />
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>
              <input
                type="checkbox"
                id="case-sensitive"
                name="caseSensitive"
                ${existingQuestion?.caseSensitive ? 'checked' : ''}
              />
              Case Sensitive
            </label>
          </div>

          <div class="form-group">
            <label>
              <input
                type="checkbox"
                id="allow-partial-match"
                name="allowPartialMatch"
                ${existingQuestion?.allowPartialMatch ? 'checked' : ''}
              />
              Allow Partial Match
            </label>
          </div>
        </div>

        <div class="form-group">
          <label>Tags</label>
          <div id="tag-selector-container"></div>
        </div>

        <div class="form-group">
          <label for="difficulty">Difficulty (1-5)</label>
          <input
            type="number"
            id="difficulty"
            name="difficulty"
            min="1"
            max="5"
            value="${existingQuestion?.difficulty || 1}"
          />
        </div>

        <div class="form-actions">
          <button type="submit" class="btn btn-primary">
            ${isEditing ? 'Update Question' : 'Create Question'}
          </button>
          <button type="button" class="btn btn-secondary" id="cancel-btn">
            Cancel
          </button>
        </div>
      </form>
    </div>
  `;

  // Initialize tag selector
  tagSelector = new TagSelector({
    containerId: 'tag-selector-container',
    initialTags
  });

  // Handle form submission
  const form = document.getElementById('question-form') as HTMLFormElement;
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleFormSubmit(form, questionId);
    });
  }

  // Handle cancel button
  const cancelBtn = document.getElementById('cancel-btn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      navigate('/questions/single_answer');
    });
  }
}

async function handleFormSubmit(form: HTMLFormElement, questionId?: string): Promise<void> {
  const formData = new FormData(form);

  const data = {
    questionText: formData.get('questionText') as string,
    correctAnswer: formData.get('correctAnswer') as string,
    caseSensitive: formData.get('caseSensitive') === 'on',
    allowPartialMatch: formData.get('allowPartialMatch') === 'on',
    tags: tagSelector?.getTags() || [],
    difficulty: parseInt(formData.get('difficulty') as string) || 1,
  };

  try {
    if (questionId) {
      // Update existing question
      await updateSingleAnswerQuestion(questionId, data);
    } else {
      // Create new question
      await createSingleAnswerQuestion(data);
    }

    // Navigate back to list
    navigate('/questions/single_answer');
  } catch (error) {
    console.error('Failed to save question:', error);
    alert('Failed to save question. Please check the console for details.');
  }
}
