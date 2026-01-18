import { navigate } from '../router';
import {
  createMultiChoiceQuestion,
  getMultiChoiceQuestion,
  updateMultiChoiceQuestion,
  type MultiChoiceQuestion
} from '../storage/multiChoiceQuestions';
import { TagSelector } from '../components/tagSelector';
import { html, attr, raw } from '../utils/html';

let tagSelector: TagSelector | null = null;

interface OptionState {
  optionText: string;
  isCorrect: boolean;
}

let options: OptionState[] = [];

export function renderMultiChoiceFormPage(questionId?: string): void {
  const app = document.getElementById('app');
  if (!app) return;

  let existingQuestion: MultiChoiceQuestion | null = null;
  if (questionId) {
    existingQuestion = getMultiChoiceQuestion(questionId);
    if (!existingQuestion) {
      alert('Question not found');
      navigate('/questions/multi_choice');
      return;
    }
  }

  const isEditing = !!existingQuestion;
  const title = isEditing ? 'Edit Question' : 'Add New Question';
  const initialTags = existingQuestion?.tags.map(t => t.tagName) || [];

  // Initialize options state
  if (existingQuestion) {
    options = existingQuestion.options.map(o => ({
      optionText: o.optionText,
      isCorrect: o.isCorrect
    }));
  } else {
    options = [
      { optionText: '', isCorrect: false },
      { optionText: '', isCorrect: false }
    ];
  }

  app.innerHTML = html`
    <div class="container">
      <div class="page-header">
        <a href="#/questions/multi_choice" class="back-link">&larr; Back to Questions</a>
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

        <div class="form-row">
          <div class="form-group">
            <label>
              <input
                type="checkbox"
                id="allow-multiple"
                name="allowMultipleSelection"
                ${existingQuestion?.allowMultipleSelection ? 'checked' : ''}
              />
              Allow multiple correct answers
            </label>
          </div>

          <div class="form-group">
            <label>
              <input
                type="checkbox"
                id="shuffle-options"
                name="shuffleOptions"
                ${existingQuestion?.shuffleOptions ? 'checked' : ''}
              />
              Shuffle options when presenting
            </label>
          </div>
        </div>

        <div class="form-group">
          <label>Options *</label>
          <div id="options-container" class="options-container"></div>
          <button type="button" id="add-option-btn" class="btn btn-secondary btn-small">
            + Add Option
          </button>
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

  renderOptions();

  tagSelector = new TagSelector({
    containerId: 'tag-selector-container',
    initialTags
  });

  const form = document.getElementById('question-form') as HTMLFormElement;
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleFormSubmit(form, questionId);
    });
  }

  const cancelBtn = document.getElementById('cancel-btn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      navigate('/questions/multi_choice');
    });
  }

  const addOptionBtn = document.getElementById('add-option-btn');
  if (addOptionBtn) {
    addOptionBtn.addEventListener('click', () => {
      options.push({ optionText: '', isCorrect: false });
      renderOptions();
    });
  }
}

function renderOptions(): void {
  const container = document.getElementById('options-container');
  if (!container) return;

  const allowMultiple = (document.getElementById('allow-multiple') as HTMLInputElement)?.checked ?? false;
  const inputType = allowMultiple ? 'checkbox' : 'radio';

  container.innerHTML = html`${raw(options.map((opt, index) => html`
    <div class="option-item" data-index="${index}">
      <input
        type="${inputType}"
        name="correct-option"
        class="option-correct"
        data-index="${index}"
        ${opt.isCorrect ? 'checked' : ''}
        title="Mark as correct"
      />
      <input
        type="text"
        class="option-text"
        data-index="${index}"
        value="${attr(opt.optionText)}"
        placeholder="Option ${index + 1}"
        required
      />
      <button
        type="button"
        class="btn-icon remove-option-btn"
        data-index="${index}"
        title="Remove option"
        ${options.length <= 2 ? 'disabled' : ''}
      >🗑️</button>
    </div>
  `).join(''))}`;


  // Bind events
  container.querySelectorAll('.option-text').forEach(input => {
    input.addEventListener('input', (e) => {
      const idx = parseInt((e.target as HTMLElement).dataset.index || '0');
      options[idx].optionText = (e.target as HTMLInputElement).value;
    });
  });

  container.querySelectorAll('.option-correct').forEach(input => {
    input.addEventListener('change', (e) => {
      const idx = parseInt((e.target as HTMLElement).dataset.index || '0');
      const checked = (e.target as HTMLInputElement).checked;

      if (inputType === 'radio') {
        // Single selection: uncheck all others
        options.forEach((opt, i) => {
          opt.isCorrect = i === idx;
        });
      } else {
        options[idx].isCorrect = checked;
      }
    });
  });

  container.querySelectorAll('.remove-option-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt((e.target as HTMLElement).dataset.index || '0');
      if (options.length > 2) {
        options.splice(idx, 1);
        renderOptions();
      }
    });
  });

  // Re-render when allow-multiple changes
  const allowMultipleCheckbox = document.getElementById('allow-multiple');
  if (allowMultipleCheckbox && !allowMultipleCheckbox.dataset.bound) {
    allowMultipleCheckbox.dataset.bound = 'true';
    allowMultipleCheckbox.addEventListener('change', () => {
      // When switching to single mode, keep only the first correct answer
      const allowMulti = (allowMultipleCheckbox as HTMLInputElement).checked;
      if (!allowMulti) {
        let foundFirst = false;
        options.forEach(opt => {
          if (opt.isCorrect && !foundFirst) {
            foundFirst = true;
          } else {
            opt.isCorrect = false;
          }
        });
      }
      renderOptions();
    });
  }
}

async function handleFormSubmit(form: HTMLFormElement, questionId?: string): Promise<void> {
  const formData = new FormData(form);
  const allowMultiple = formData.get('allowMultipleSelection') === 'on';

  // Validate options
  const filledOptions = options.filter(o => o.optionText.trim() !== '');
  if (filledOptions.length < 2) {
    alert('Please provide at least 2 options');
    return;
  }

  const correctCount = filledOptions.filter(o => o.isCorrect).length;
  if (correctCount === 0) {
    alert('Please mark at least one option as correct');
    return;
  }

  if (!allowMultiple && correctCount !== 1) {
    alert('Single answer mode requires exactly one correct answer');
    return;
  }

  const data = {
    questionText: formData.get('questionText') as string,
    options: filledOptions.map(o => ({ optionText: o.optionText.trim(), isCorrect: o.isCorrect })),
    shuffleOptions: formData.get('shuffleOptions') === 'on',
    allowMultipleSelection: allowMultiple,
    tags: tagSelector?.getTags() || [],
    difficulty: parseInt(formData.get('difficulty') as string) || 1,
  };

  try {
    if (questionId) {
      await updateMultiChoiceQuestion(questionId, data);
    } else {
      await createMultiChoiceQuestion(data);
    }
    navigate('/questions/multi_choice');
  } catch (error) {
    console.error('Failed to save question:', error);
    alert('Failed to save question. ' + (error instanceof Error ? error.message : ''));
  }
}

