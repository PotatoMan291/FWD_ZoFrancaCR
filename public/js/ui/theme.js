const THEME_KEY = "zofranca-theme";

function preferredTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "dark" || saved === "light") return saved;
  return globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function updateButton(button, theme) {
  if (!button) return;
  const icon = button.querySelector(".material-symbols-outlined");
  if (icon) icon.textContent = theme === "dark" ? "light_mode" : "dark_mode";
  button.setAttribute("aria-label", theme === "dark" ? "Activar modo claro" : "Activar modo nocturno");
  button.title = button.getAttribute("aria-label");
}

export function applyTheme(theme, button = null) {
  const validTheme = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = validTheme;
  localStorage.setItem(THEME_KEY, validTheme);
  updateButton(button, validTheme);
  return validTheme;
}

export function initializeTheme(button = null) {
  const theme = applyTheme(preferredTheme(), button);
  button?.addEventListener("click", () => {
    const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(nextTheme, button);
  });
  return theme;
}

