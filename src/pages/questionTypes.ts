import { query } from '../storage/sqlite';

export function renderQuestionTypesPage(): void {
  const app = document.getElementById('app');
  if (!app) return;

  // Fetch available question types from database
  const questionTypes = query('SELECT type_code, description FROM question_types ORDER BY type_code');

  const typesList = questionTypes.map(type => `
    <li class="question-type-item">
      <a href="#/questions/${type.type_code}" class="question-type-link">
        <div class="question-type-code">${type.type_code}</div>
        <div class="question-type-description">${type.description}</div>
      </a>
    </li>
  `).join('');

  app.innerHTML = `
    <div class="container">
      <div class="page-header">
        <a href="#/" class="back-link">&larr; Back</a>
        <h1>Question Maintenance</h1>
      </div>

      <p>Select a question type to manage:</p>

      <ul class="question-types-list">
        ${typesList}
      </ul>
    </div>
  `;
}
