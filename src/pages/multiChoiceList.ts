import { getAllMultiChoiceQuestions, deleteMultiChoiceQuestion } from '../storage/multiChoiceQuestions';
import { navigate } from '../router';
import { html, raw } from '../utils/html';

export function renderMultiChoiceListPage(): void {
  const app = document.getElementById('app');
  if (!app) return;

  const questions = getAllMultiChoiceQuestions();

  const questionsList = questions.length === 0
    ? '<p class="empty-message">No questions yet. Create your first question!</p>'
    : questions.map(q => html`
        <li class="question-item">
          <div class="question-content">
            <div class="question-text">${q.questionText}</div>
            <div class="question-meta">
              <span class="option-count">${q.options.length} options</span>
              <span class="selection-mode">${q.allowMultipleSelection ? 'Multiple answers' : 'Single answer'}</span>
              ${raw(q.tags.length > 0 ? html`
                <div class="question-tags">
                  ${raw(q.tags.map(tag => html`<span class="tag-chip">${tag.tagName}</span>`).join(''))}
                </div>
              ` : '')}
              <span class="difficulty">Difficulty: ${q.difficulty}</span>
            </div>
          </div>
          <div class="question-actions">
            <button class="btn-icon edit-btn" data-id="${q.questionId}" title="Edit">✏️</button>
            <button class="btn-icon delete-btn" data-id="${q.questionId}" title="Delete">🗑️</button>
          </div>
        </li>
      `).join('');

  app.innerHTML = html`
    <div class="container">
      <div class="page-header">
        <a href="#/questions" class="back-link">&larr; Back to Question Types</a>
        <h1>Multiple Choice Questions</h1>
      </div>

      <div class="page-actions">
        <button class="btn btn-primary" id="add-question-btn">Add New Question</button>
      </div>

      ${raw(questions.length === 0 ? questionsList : `<ul class="questions-list">${questionsList}</ul>`)}
    </div>
  `;

  const addBtn = document.getElementById('add-question-btn');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      navigate('/questions/multi_choice/add');
    });
  }

  const editBtns = document.querySelectorAll('.edit-btn');
  editBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const questionId = (btn as HTMLElement).dataset.id;
      if (questionId) {
        navigate(`/questions/multi_choice/edit/${questionId}`);
      }
    });
  });

  const deleteBtns = document.querySelectorAll('.delete-btn');
  deleteBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      const questionId = (btn as HTMLElement).dataset.id;
      if (questionId && confirm('Are you sure you want to delete this question?')) {
        await deleteMultiChoiceQuestion(questionId);
        renderMultiChoiceListPage();
      }
    });
  });
}

