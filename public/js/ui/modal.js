import { escapeHtml } from "./feedback.js";

let modalSequence = 0;

function ensureModalRoot() {
  let root = document.querySelector("#modalRoot");
  if (!root) {
    root = document.createElement("div");
    root.id = "modalRoot";
    document.body.append(root);
  }
  return root;
}

function focusableElements(container) {
  return [...container.querySelectorAll(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )].filter((element) => !element.hidden);
}

export function openModal({ title, content, size = "medium", dismissible = true, onClose = null }) {
  const root = ensureModalRoot();
  const previousFocus = document.activeElement;
  const id = `modal-title-${++modalSequence}`;
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <section class="modal modal-${escapeHtml(size)}" role="dialog" aria-modal="true" aria-labelledby="${id}">
      <header class="modal-header">
        <h2 id="${id}">${escapeHtml(title)}</h2>
        ${
          dismissible
            ? '<button type="button" class="modal-close" data-modal-close aria-label="Cancelar y cerrar"><span class="material-symbols-outlined" aria-hidden="true">close</span></button>'
            : ""
        }
      </header>
      <div class="modal-body"></div>
    </section>
  `;

  const modal = backdrop.querySelector(".modal");
  const body = backdrop.querySelector(".modal-body");
  if (content instanceof Node) body.append(content);
  else body.innerHTML = content;

  let closed = false;
  const close = (reason = "cancel") => {
    if (closed) return;
    closed = true;
    backdrop.classList.add("modal-closing");
    globalThis.setTimeout(() => {
      backdrop.remove();
      if (!root.children.length) document.body.classList.remove("modal-open");
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
      onClose?.(reason);
    }, 150);
  };

  const handleKeydown = (event) => {
    if (event.key === "Escape" && dismissible) {
      event.preventDefault();
      close("cancel");
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = focusableElements(modal);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  backdrop.addEventListener("keydown", handleKeydown);
  backdrop.querySelector("[data-modal-close]")?.addEventListener("click", () => close("cancel"));
  backdrop.addEventListener("mousedown", (event) => {
    if (dismissible && event.target === backdrop) close("cancel");
  });

  root.append(backdrop);
  document.body.classList.add("modal-open");
  globalThis.requestAnimationFrame(() => {
    backdrop.classList.add("modal-visible");
    (focusableElements(modal)[0] || modal).focus?.();
  });

  return { element: backdrop, modal, body, close };
}

export function confirmAction({
  title = "Confirmar acción",
  message,
  confirmText = "Continuar",
  cancelText = "Cancelar",
  danger = false,
}) {
  return new Promise((resolve) => {
    let answered = false;
    const dialog = openModal({
      title,
      size: "small",
      content: `
        <div class="confirm-message">
          <span class="material-symbols-outlined ${danger ? "danger-text" : "warning-text"}" aria-hidden="true">
            ${danger ? "warning" : "help"}
          </span>
          <p>${escapeHtml(message)}</p>
        </div>
        <div class="modal-actions">
          <button type="button" class="secondary-btn" data-confirm-cancel>${escapeHtml(cancelText)}</button>
          <button type="button" class="${danger ? "danger-btn" : "primary-btn"}" data-confirm-accept>${escapeHtml(confirmText)}</button>
        </div>
      `,
      onClose: () => {
        if (!answered) resolve(false);
      },
    });

    dialog.element.querySelector("[data-confirm-cancel]").addEventListener("click", () => {
      answered = true;
      dialog.close("cancel");
      resolve(false);
    });
    dialog.element.querySelector("[data-confirm-accept]").addEventListener("click", () => {
      answered = true;
      dialog.close("confirm");
      resolve(true);
    });
  });
}

export function showInformation(title, message) {
  const dialog = openModal({
    title,
    size: "small",
    content: `
      <p class="information-message">${escapeHtml(message)}</p>
      <div class="modal-actions">
        <button type="button" class="primary-btn" data-modal-ok>Entendido</button>
      </div>
    `,
  });
  dialog.element.querySelector("[data-modal-ok]").addEventListener("click", () => dialog.close("confirm"));
  return dialog;
}
