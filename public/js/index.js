import { initializeApp } from "./app.js";
import { escapeHtml } from "./ui/feedback.js";

document.addEventListener("DOMContentLoaded", () => {
  try {
    initializeApp();
  } catch (error) {
    console.error("No se pudo iniciar ZoFranca CR:", error);
    document.body.innerHTML = `
      <main class="fatal-error" role="alert">
        <h1>No se pudo iniciar ZoFranca CR</h1>
        <p>${escapeHtml(error.message || "Error inesperado")}</p>
      </main>
    `;
  }
});
