import { DEFAULT_SECTORS } from "./config.js";
import { ValidationError } from "./validators.js";
import {
  createApplication,
  filterApplications,
  getApplicationBundle,
  saveHumanDecision,
  softDeleteApplication,
} from "./services/applicationsService.js";
import { evaluateApplication, processPendingApplications } from "./services/aiService.js";
import {
  createComplianceReport,
  getComplianceData,
  resolveAlert,
  summarizeCompliance,
} from "./services/complianceService.js";
import { getCompanyTimeline } from "./services/auditService.js";
import { getDashboardData } from "./services/dashboardService.js";
import { getCurrentZone, saveZone } from "./services/zonesService.js";
import { clearSession, ensureSession, saveSession } from "./session.js";
import {
  applicationDetailTemplate,
  applicationFormTemplate,
  helpTemplate,
  historyTemplate,
  loginTemplate,
  renderAlertsView,
  renderApplicationsView,
  renderComplianceView,
  renderHomeView,
  renderZoneView,
  reportFormTemplate,
} from "./views/templates.js";
import {
  applyFieldErrors,
  clearFieldErrors,
  notify,
  renderMainError,
  renderMainLoading,
  setButtonBusy,
} from "./ui/feedback.js";
import { confirmAction, openModal } from "./ui/modal.js";
import { initializeTheme } from "./ui/theme.js";

const VIEW_LABELS = Object.freeze({
  inicio: "Inicio",
  solicitudes: "Solicitudes",
  cumplimiento: "Cumplimiento",
  alertas: "Alertas",
  zona: "Zona Franca",
});

const state = {
  view: "solicitudes",
  page: 1,
  filters: { search: "", estado: "", sector: "", zonaFrancaId: "", fecha: "" },
  session: null,
};

let main;
let searchTimer = null;

export function initializeApp() {
  main = document.querySelector("#appMain") || document.querySelector("main");
  if (!main) throw new Error("No se encontró el contenedor principal de la aplicación.");

  state.session = ensureSession();
  initializeTheme(document.querySelector("#themeToggle"));
  updateSessionInterface();
  bindGlobalEvents();

  const initialHash = globalThis.location.hash.replace("#", "");
  if (VIEW_LABELS[initialHash]) state.view = initialHash;
  navigate(state.view, { updateHash: false });
}

function bindGlobalEvents() {
  document.querySelectorAll("[data-view]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      navigate(link.dataset.view);
    });
  });

  document.querySelector("#notificationsButton")?.addEventListener("click", () => navigate("alertas"));
  document.querySelector("#helpButton")?.addEventListener("click", showHelp);
  document.querySelector("#sessionProfile")?.addEventListener("click", logout);
  document.querySelector("#profileButton")?.addEventListener("click", logout);

  main.addEventListener("click", handleMainClick);
  main.addEventListener("submit", handleMainSubmit);
  main.addEventListener("change", handleFilterChange);
  main.addEventListener("input", handleSearchInput);

  globalThis.addEventListener("hashchange", () => {
    const view = globalThis.location.hash.replace("#", "");
    if (VIEW_LABELS[view] && view !== state.view) navigate(view, { updateHash: false });
  });
}

async function navigate(view, { updateHash = true } = {}) {
  if (!VIEW_LABELS[view]) view = "solicitudes";
  state.view = view;
  if (updateHash) history.replaceState(null, "", `#${view}`);

  document.querySelectorAll("[data-view]").forEach((link) => {
    const active = link.dataset.view === view;
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  const breadcrumb = document.querySelector("#breadcrumb");
  if (breadcrumb) breadcrumb.textContent = VIEW_LABELS[view];

  renderMainLoading(main, `Cargando ${VIEW_LABELS[view].toLowerCase()}...`);
  try {
    if (view === "inicio") {
      main.innerHTML = renderHomeView(await getDashboardData());
    } else if (view === "solicitudes") {
      await renderApplicationsPage();
    } else if (view === "cumplimiento") {
      const data = await getComplianceData();
      main.innerHTML = renderComplianceView(data, summarizeCompliance(data));
    } else if (view === "alertas") {
      main.innerHTML = renderAlertsView(await getComplianceData());
    } else if (view === "zona") {
      const zone = await getCurrentZone();
      main.innerHTML = renderZoneView(zone, [...new Set([...DEFAULT_SECTORS, ...(zone.sectoresPermitidos || [])])]);
    }
  } catch (error) {
    renderMainError(main, error, view);
  }
}

async function renderApplicationsPage({ focusSearch = false } = {}) {
  const dashboard = await getDashboardData();
  const applications = filterApplications(dashboard.applications, state.filters);
  main.innerHTML = renderApplicationsView({
    applications,
    metrics: dashboard.applicationMetrics,
    zones: dashboard.zones,
    filters: state.filters,
    page: state.page,
  });

  if (focusSearch) {
    const input = main.querySelector("#searchApplications");
    input?.focus();
    input?.setSelectionRange(input.value.length, input.value.length);
  }
}

async function handleMainClick(event) {
  const navigation = event.target.closest("[data-nav-view]");
  if (navigation) return navigate(navigation.dataset.navView);

  const pageButton = event.target.closest("[data-page]");
  if (pageButton && !pageButton.disabled) {
    state.page = Number(pageButton.dataset.page) || 1;
    return renderApplicationsPage();
  }

  const actionElement = event.target.closest("[data-action]");
  if (!actionElement) return;
  const { action, id, view } = actionElement.dataset;

  try {
    if (action === "retry-view") return await navigate(view || state.view, { updateHash: false });
    if (action === "clear-filters") return clearFilters();
    if (action === "new-application") return await openNewApplication();
    if (action === "view-application") return await openApplicationDetail(id);
    if (action === "process-pending") return await processBatch(actionElement);
    if (action === "new-report") return await openNewReport();
    if (action === "resolve-alert") return await resolveSelectedAlert(id, actionElement);
    if (action === "view-company-history") return await openCompanyHistory(id);
  } catch (error) {
    notify(error.message || "No fue posible completar la acción.", "error");
  }
}

async function handleMainSubmit(event) {
  if (event.target.id !== "zoneForm") return;
  event.preventDefault();
  const form = event.target;
  const submitButton = form.querySelector("[type='submit']");
  const formData = new FormData(form);
  const payload = {
    nombre: formData.get("nombre"),
    inversionMinima: formData.get("inversionMinima"),
    empleosMinimos: formData.get("empleosMinimos"),
    sectoresPermitidos: formData.getAll("sectoresPermitidos"),
  };

  try {
    clearFieldErrors(form);
    const confirmed = await confirmAction({
      title: "Guardar configuración",
      message: "¿Desea aplicar estos criterios a las próximas evaluaciones?",
      confirmText: "Guardar cambios",
    });
    if (!confirmed) return;
    setButtonBusy(submitButton, true, "Guardando...");
    await saveZone(payload, state.session.nombre);
    notify("La configuración de la zona franca se guardó correctamente.");
    await navigate("zona", { updateHash: false });
  } catch (error) {
    if (error instanceof ValidationError) applyFieldErrors(form, error.fields);
    notify(error.message, "error");
  } finally {
    setButtonBusy(submitButton, false);
  }
}

function handleFilterChange(event) {
  const filterMap = {
    filterState: "estado",
    filterSector: "sector",
    filterZone: "zonaFrancaId",
    filterDate: "fecha",
  };
  const key = filterMap[event.target.id];
  if (!key) return;
  state.filters[key] = event.target.value;
  state.page = 1;
  renderApplicationsPage().catch((error) => renderMainError(main, error, "solicitudes"));
}

function handleSearchInput(event) {
  if (event.target.id !== "searchApplications") return;
  state.filters.search = event.target.value;
  state.page = 1;
  globalThis.clearTimeout(searchTimer);
  searchTimer = globalThis.setTimeout(() => {
    renderApplicationsPage({ focusSearch: true }).catch((error) =>
      renderMainError(main, error, "solicitudes"),
    );
  }, 250);
}

function clearFilters() {
  state.filters = { search: "", estado: "", sector: "", zonaFrancaId: "", fecha: "" };
  state.page = 1;
  renderApplicationsPage().catch((error) => renderMainError(main, error, "solicitudes"));
}

async function openNewApplication() {
  const zone = await getCurrentZone();
  const dialog = openModal({
    title: "Nueva solicitud de instalación",
    content: applicationFormTemplate(zone),
    size: "large",
  });
  dialog.element.querySelector("[data-modal-close-form]").addEventListener("click", () => dialog.close());
  const form = dialog.element.querySelector("#applicationForm");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = form.querySelector("[type='submit']");
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());
    payload.documentos = String(formData.get("documentos") || "")
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean);

    try {
      clearFieldErrors(form);
      const confirmed = await confirmAction({
        title: "Enviar solicitud",
        message: "¿Desea registrar esta solicitud como Pendiente? Puede cancelar para revisar los datos.",
        confirmText: "Enviar solicitud",
      });
      if (!confirmed) return;
      setButtonBusy(submitButton, true, "Enviando...");
      await createApplication(payload, zone.id);
      dialog.close("saved");
      notify("La solicitud se registró correctamente.");
      await navigate("solicitudes", { updateHash: false });
    } catch (error) {
      if (error instanceof ValidationError) applyFieldErrors(form, error.fields);
      notify(error.message, "error");
    } finally {
      setButtonBusy(submitButton, false);
    }
  });
}

async function openApplicationDetail(applicationId) {
  const bundle = await getApplicationBundle(applicationId);
  const dialog = openModal({
    title: `Solicitud: ${bundle.application.empresa}`,
    content: applicationDetailTemplate(bundle, state.session),
    size: "large",
  });

  dialog.element.addEventListener("click", async (event) => {
    const actionButton = event.target.closest("[data-action]");
    if (!actionButton) return;
    const action = actionButton.dataset.action;
    try {
      if (action === "evaluate-one") {
        const confirmed = await confirmAction({
          title: "Evaluar solicitud",
          message: "¿Desea enviar el perfil al motor de IA simulada?",
          confirmText: "Evaluar",
        });
        if (!confirmed) return;
        setButtonBusy(actionButton, true, "Evaluando...");
        await evaluateApplication(applicationId);
        dialog.close("evaluated");
        notify("La evaluación de IA finalizó correctamente.");
        await navigate("solicitudes", { updateHash: false });
      } else if (action === "delete-application") {
        const confirmed = await confirmAction({
          title: "Eliminar solicitud",
          message: "La solicitud se ocultará de la lista, pero conservará su trazabilidad. ¿Desea continuar?",
          confirmText: "Eliminar solicitud",
          danger: true,
        });
        if (!confirmed) return;
        await softDeleteApplication(applicationId, state.session.nombre);
        dialog.close("deleted");
        notify("La solicitud fue eliminada de la vista.", "warning");
        await navigate("solicitudes", { updateHash: false });
      } else if (action === "view-company-history") {
        await openCompanyHistory(actionButton.dataset.id);
      }
    } catch (error) {
      notify(error.message, "error");
      setButtonBusy(actionButton, false);
    }
  });

  const decisionForm = dialog.element.querySelector("#decisionForm");
  decisionForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = decisionForm.querySelector("[type='submit']");
    const payload = Object.fromEntries(new FormData(decisionForm).entries());
    try {
      clearFieldErrors(decisionForm);
      const confirmed = await confirmAction({
        title: "Registrar decisión humana",
        message: "Esta acción establecerá el estado final de la solicitud. ¿Desea continuar?",
        confirmText: "Guardar decisión",
      });
      if (!confirmed) return;
      setButtonBusy(submitButton, true, "Guardando...");
      await saveHumanDecision(applicationId, payload);
      dialog.close("decided");
      notify("La decisión del analista quedó registrada.");
      await navigate("solicitudes", { updateHash: false });
    } catch (error) {
      if (error instanceof ValidationError) applyFieldErrors(decisionForm, error.fields);
      notify(error.message, "error");
    } finally {
      setButtonBusy(submitButton, false);
    }
  });
}

async function processBatch(button) {
  const confirmed = await confirmAction({
    title: "Procesar solicitudes pendientes",
    message: "Las solicitudes pendientes se evaluarán en paralelo mediante Promise.all. ¿Desea continuar?",
    confirmText: "Procesar lote",
  });
  if (!confirmed) return;

  try {
    setButtonBusy(button, true, "Procesando lote...");
    const results = await processPendingApplications();
    notify(`${results.length} solicitud(es) fueron evaluadas en paralelo.`);
    await navigate("solicitudes", { updateHash: false });
  } catch (error) {
    notify(error.message, "error");
  } finally {
    setButtonBusy(button, false);
  }
}

async function openNewReport() {
  const data = await getComplianceData();
  if (!data.companies.length) {
    notify("Primero debe aprobar una solicitud para crear una empresa instalada.", "warning");
    return;
  }

  const dialog = openModal({ title: "Nuevo reporte de cumplimiento", content: reportFormTemplate(data.companies), size: "large" });
  dialog.element.querySelector("[data-modal-close-form]").addEventListener("click", () => dialog.close());
  const form = dialog.element.querySelector("#reportForm");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = form.querySelector("[type='submit']");
    const payload = Object.fromEntries(new FormData(form).entries());
    try {
      clearFieldErrors(form);
      const confirmed = await confirmAction({
        title: "Procesar reporte",
        message: "El sistema calculará el cumplimiento y generará las alertas correspondientes. ¿Desea continuar?",
        confirmText: "Procesar reporte",
      });
      if (!confirmed) return;
      setButtonBusy(submitButton, true, "Procesando...");
      const result = await createComplianceReport(payload, state.session.nombre);
      dialog.close("saved");
      notify(`Reporte guardado. Se generaron ${result.alerts.length} alerta(s).`);
      await navigate("cumplimiento", { updateHash: false });
    } catch (error) {
      if (error instanceof ValidationError) applyFieldErrors(form, error.fields);
      notify(error.message, "error");
    } finally {
      setButtonBusy(submitButton, false);
    }
  });
}

async function resolveSelectedAlert(alertId, button) {
  const confirmed = await confirmAction({
    title: "Resolver alerta",
    message: "¿Confirma que la alerta fue revisada y desea marcarla como resuelta?",
    confirmText: "Marcar resuelta",
  });
  if (!confirmed) return;
  try {
    setButtonBusy(button, true, "Guardando...");
    await resolveAlert(alertId, state.session.nombre);
    notify("La alerta se marcó como resuelta.");
    await navigate("alertas", { updateHash: false });
  } catch (error) {
    notify(error.message, "error");
  } finally {
    setButtonBusy(button, false);
  }
}

async function openCompanyHistory(companyId) {
  const events = await getCompanyTimeline(companyId);
  openModal({ title: "Historial empresarial", content: historyTemplate(events), size: "large" });
}

function showHelp() {
  openModal({ title: "Ayuda de ZoFranca CR", content: helpTemplate(), size: "medium" });
}

async function logout() {
  const confirmed = await confirmAction({
    title: "Cerrar sesión",
    message: "¿Desea cerrar la sesión académica actual? Puede cancelar para continuar trabajando.",
    confirmText: "Cerrar sesión",
    danger: true,
  });
  if (!confirmed) return;
  clearSession();
  showLogin();
}

function showLogin() {
  const dialog = openModal({ title: "Ingresar a ZoFranca CR", content: loginTemplate(), size: "small", dismissible: false });
  const form = dialog.element.querySelector("#loginForm");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      state.session = saveSession(Object.fromEntries(new FormData(form).entries()));
      updateSessionInterface();
      dialog.close("login");
      notify("Sesión académica iniciada correctamente.");
    } catch (error) {
      notify(error.message, "error");
    }
  });
}

function updateSessionInterface() {
  document.querySelectorAll("[data-session-name]").forEach((element) => {
    element.textContent = state.session.nombre;
  });
  document.querySelectorAll("[data-session-role]").forEach((element) => {
    element.textContent = state.session.rol;
  });
}
