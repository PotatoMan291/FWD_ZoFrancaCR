export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function formatCurrency(value) {
  return new Intl.NumberFormat("es-CR", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

export function formatDate(value, { includeTime = false } = {}) {
  if (!value) return "No disponible";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha inválida";
  return new Intl.DateTimeFormat("es-CR", {
    dateStyle: "medium",
    ...(includeTime ? { timeStyle: "short" } : {}),
  }).format(date);
}

export function formatPercentage(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `${number.toFixed(2).replace(/\.00$/, "")}%` : "No disponible";
}

function ensureToastRegion() {
  let region = document.querySelector("#toastRegion");
  if (!region) {
    region = document.createElement("div");
    region.id = "toastRegion";
    region.className = "toast-region";
    region.setAttribute("aria-live", "polite");
    region.setAttribute("aria-atomic", "true");
    document.body.append(region);
  }
  return region;
}

export function notify(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="material-symbols-outlined" aria-hidden="true">${
      type === "error" ? "error" : type === "warning" ? "warning" : "check_circle"
    }</span>
    <span>${escapeHtml(message)}</span>
    <button type="button" aria-label="Cerrar notificación">
      <span class="material-symbols-outlined" aria-hidden="true">close</span>
    </button>
  `;
  const close = () => {
    toast.classList.add("toast-leaving");
    globalThis.setTimeout(() => toast.remove(), 180);
  };
  toast.querySelector("button").addEventListener("click", close);
  ensureToastRegion().append(toast);
  globalThis.setTimeout(close, 5000);
}

export function renderMainLoading(container, message = "Cargando información...") {
  container.innerHTML = `
    <section class="view-state" role="status">
      <span class="spinner" aria-hidden="true"></span>
      <h2>${escapeHtml(message)}</h2>
      <p>La interfaz permanece disponible mientras finaliza la operación.</p>
    </section>
  `;
}

export function renderMainError(container, error, retryView = "solicitudes") {
  container.innerHTML = `
    <section class="view-state view-state-error" role="alert">
      <span class="material-symbols-outlined" aria-hidden="true">error</span>
      <h2>No se pudo cargar la información</h2>
      <p>${escapeHtml(error.message || "Ocurrió un error inesperado.")}</p>
      <button type="button" class="primary-btn" data-action="retry-view" data-view="${escapeHtml(retryView)}">
        Reintentar
      </button>
    </section>
  `;
}

export function setButtonBusy(button, busy, busyText = "Procesando...") {
  if (!button) return;
  if (busy) {
    button.dataset.originalHtml = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<span class="spinner spinner-small" aria-hidden="true"></span>${escapeHtml(busyText)}`;
  } else {
    button.disabled = false;
    if (button.dataset.originalHtml) button.innerHTML = button.dataset.originalHtml;
    delete button.dataset.originalHtml;
  }
}

export function clearFieldErrors(form) {
  form.querySelectorAll(".field-error").forEach((element) => element.remove());
  form.querySelectorAll("[aria-invalid='true']").forEach((element) => {
    element.removeAttribute("aria-invalid");
  });
}

export function applyFieldErrors(form, fields = {}) {
  clearFieldErrors(form);
  Object.entries(fields).forEach(([name, message]) => {
    const control = form.elements.namedItem(name);
    if (!control) return;
    const target = control instanceof RadioNodeList ? control[0] : control;
    target?.setAttribute("aria-invalid", "true");
    const group = target?.closest(".form-field, .form-group") || target?.parentElement;
    if (!group) return;
    const error = document.createElement("small");
    error.className = "field-error";
    error.textContent = message;
    group.append(error);
  });
}

