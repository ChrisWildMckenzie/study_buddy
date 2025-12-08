import { getAllSingleAnswerQuestions, deleteSingleAnswerQuestion } from '../storage/singleAnswerQuestions';
import { navigate } from '../router';

export function renderSingleAnswerListPage(): void {
  const app = document.getElementById('app');
  if (!app) return;

  const questions = getAllSingleAnswerQuestions();

  const questionsList = questions.length === 0
    ? '<p class="empty-message">No questions yet. Create your first question!</p>'
    : `
      <ul class="questions-list">
        ${questions.map(q => `
          <li class="question-item">
            <div class="question-content">
              <div class="question-text">${escapeHtml(q.questionText)}</div>
              <div class="question-meta">
                ${q.tags.length > 0 ? `
                  <div class="question-tags">
                    ${q.tags.map(tag => `<span class="tag-chip">${escapeHtml(tag.tagName)}</span>`).join('')}
                  </div>
                ` : ''}
                <span class="difficulty">Difficulty: ${q.difficulty}</span>
              </div>
            </div>
            <div class="question-actions">
              <button class="btn-icon edit-btn" data-id="${q.questionId}" title="Edit">✏️</button>
              <button class="btn-icon delete-btn" data-id="${q.questionId}" title="Delete">🗑️</button>
            </div>
          </li>
        `).join('')}
      </ul>
    `;

  app.innerHTML = `
    <div class="container">
      <div class="page-header">
        <a href="#/questions" class="back-link">&larr; Back to Question Types</a>
        <h1>Single Answer Questions</h1>
      </div>

      <div class="page-actions">
        <button class="btn btn-primary" id="add-question-btn">Add New Question</button>
      </div>

      ${questionsList}
    </div>
  `;

  // Add event listener for add button
  const addBtn = document.getElementById('add-question-btn');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      navigate('/questions/single_answer/add');
    });
  }

  // Add event listeners for edit buttons
  const editBtns = document.querySelectorAll('.edit-btn');
  editBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const questionId = (btn as HTMLElement).dataset.id;
      if (questionId) {
        navigate(`/questions/single_answer/edit/${questionId}`);
      }
    });
  });

  // Add event listeners for delete buttons
  const deleteBtns = document.querySelectorAll('.delete-btn');
  deleteBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      const questionId = (btn as HTMLElement).dataset.id;
      if (questionId && confirm('Are you sure you want to delete this question?')) {
        await deleteSingleAnswerQuestion(questionId);
        renderSingleAnswerListPage(); // Re-render the page
      }
    });
  });
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
