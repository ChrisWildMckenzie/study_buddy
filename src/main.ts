import { registerSW } from 'virtual:pwa-register';
import { initDB } from './storage/indexeddb';
import { initSQLite } from './storage/sqlite';
import { initRouter, registerRoute } from './router';
import { renderHomePage } from './pages/home';
import { renderQuestionTypesPage } from './pages/questionTypes';
import { renderSingleAnswerListPage } from './pages/singleAnswerList';
import { renderSingleAnswerFormPage } from './pages/singleAnswerForm';
import { renderMultiChoiceListPage } from './pages/multiChoiceList';
import { renderMultiChoiceFormPage } from './pages/multiChoiceForm';
import './style.css';

// Register service worker for PWA
const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('New version available! Reload to update?')) {
      updateSW(true);
    }
  },
  onOfflineReady() {
    console.log('App is ready to work offline');
  },
});

// Initialize storage systems
async function initApp() {
  try {
    // Initialize IndexedDB
    await initDB();
    console.log('IndexedDB initialized');

    // Initialize SQLite
    await initSQLite();
    console.log('SQLite initialized');

    // Register routes
    registerRoute('/', renderHomePage);
    registerRoute('/questions', renderQuestionTypesPage);
    registerRoute('/questions/single_answer', renderSingleAnswerListPage);
    registerRoute('/questions/single_answer/add', () => renderSingleAnswerFormPage());
    registerRoute('/questions/single_answer/edit/:id', (params) => renderSingleAnswerFormPage(params?.id));
    registerRoute('/questions/multi_choice', renderMultiChoiceListPage);
    registerRoute('/questions/multi_choice/add', () => renderMultiChoiceFormPage());
    registerRoute('/questions/multi_choice/edit/:id', (params) => renderMultiChoiceFormPage(params?.id));

    // Initialize router
    initRouter();

    console.log('App is ready');
  } catch (error) {
    console.error('Failed to initialize app:', error);
    const app = document.getElementById('app');
    if (app) {
      app.innerHTML = `
        <div class="container error">
          <h1>Initialization Error</h1>
          <p>Failed to initialize storage systems. Please check console for details.</p>
        </div>
      `;
    }
  }
}

// Start the app
initApp();
