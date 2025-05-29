// src/main.ts
import './style.css'; // Import global styles
import { App } from './app';

// Create and start the application
try {
  new App('#app'); // Mounts the app to the <div id="app"></div> in index.html
} catch (error) {
  console.error("Failed to initialize the application:", error);
  const appRoot = document.querySelector('#app');
  if (appRoot) {
    appRoot.innerHTML = `
      <div style="padding: 20px; text-align: center; color: red;">
        <h1>Application Error</h1>
        <p>An error occurred during application startup. Please check the console for details.</p>
        <p>${(error as Error).message || 'Unknown error'}</p>
      </div>
    `;
  }
}
