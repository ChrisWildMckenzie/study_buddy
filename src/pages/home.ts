export function renderHomePage(): void {
  const app = document.getElementById('app');
  if (!app) return;

  app.innerHTML = `
    <div class="container">
      <h1>Study Buddy</h1>
      <p>Your offline-first study companion</p>

      <nav class="main-nav">
        <a href="#/questions" class="nav-link">Question Maintenance</a>
      </nav>
    </div>
  `;
}
