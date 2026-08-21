import {
  AI_CLASSIFICATIONS,
  APPLICATION_STATES,
  DEFAULT_SECTORS,
  PAGE_SIZE,
} from "../config.js";
import {
  escapeHtml,
  formatCurrency,
  formatDate,
  formatPercentage,
} from "../ui/feedback.js";

function badgeClass(value) {
  const normalized = String(value || "").toLowerCase();
  if (["recomendada", "aprobada", "en regla", "resuelta", "instalada"].includes(normalized)) {
    return "badge-success";
  }
  if (["revisar", "en revisión", "evaluada", "pendiente", "preventiva"].includes(normalized)) {
    return "badge-warning";
  }
  if (["rechazada", "crítica"].includes(normalized)) return "badge-danger";
  return "badge-neutral";
}

function scoreClass(score) {
  if (Number(score) >= 75) return "good";
  if (Number(score) >= 50) return "warn";
  return "bad";
}

function option(value, current, label = value) {
  return `<option value="${escapeHtml(value)}" ${String(value) === String(current) ? "selected" : ""}>${escapeHtml(label)}</option>`;
}

function metricCard(icon, label, value, tone = "") {
  return `
    <article class="metric-card">
      <span class="metric-icon ${tone} material-symbols-outlined" aria-hidden="true">${icon}</span>
      <p>${escapeHtml(label)}</p>
      <strong>${escapeHtml(value)}</strong>
      ${tone ? `<div class="metric-line ${tone}-line"></div>` : ""}
    </article>
  `;
}

export function renderHomeView(data) {
  const activeAlerts = data.compliance.alerts.filter((alert) => alert.estado === "Activa");
  const recentAlerts = activeAlerts.slice(0, 5);
  const average = data.applicationMetrics.averageResponseHours;

  return `
    <section class="page-heading">
      <h2>Panel general</h2>
      <p>Resumen académico de solicitudes, decisiones y cumplimiento.</p>
    </section>
    <section class="metrics-grid">
      ${metricCard("description", "TOTAL SOLICITUDES", data.applicationMetrics.total)}
      ${metricCard("verified", "APROBADAS", formatPercentage(data.applicationMetrics.approvedPercentage), "success")}
      ${metricCard("notifications_active", "ALERTAS ACTIVAS", activeAlerts.length, "warning")}
      ${metricCard("schedule", "RESPUESTA PROMEDIO", average === null ? "No disponible" : `${average.toFixed(1)} h`, "danger")}
    </section>
    <section class="content-grid">
      <article class="content-card">
        <div class="section-title">
          <div><h3>Estado del flujo</h3><p>Información calculada desde json-server.</p></div>
          <button type="button" class="text-btn" data-nav-view="solicitudes">Ver solicitudes</button>
        </div>
        <dl class="summary-list">
          <div><dt>Pendientes de IA</dt><dd>${data.applicationMetrics.pending}</dd></div>
          <div><dt>Recomendadas</dt><dd>${data.applicationMetrics.recommended}</dd></div>
          <div><dt>Por revisar</dt><dd>${data.applicationMetrics.review}</dd></div>
          <div><dt>Rechazadas</dt><dd>${data.applicationMetrics.rejected}</dd></div>
          <div><dt>Empresas instaladas</dt><dd>${data.complianceMetrics.empresas}</dd></div>
          <div><dt>Reportes recibidos</dt><dd>${data.complianceMetrics.reportes}</dd></div>
        </dl>
      </article>
      <article class="content-card">
        <div class="section-title">
          <div><h3>Alertas recientes</h3><p>Desviaciones que requieren seguimiento.</p></div>
          <button type="button" class="text-btn" data-nav-view="alertas">Ver todas</button>
        </div>
        ${
          recentAlerts.length
            ? `<ul class="alert-list">${recentAlerts
                .map(
                  (alert) => `
                    <li>
                      <span class="status-dot ${alert.gravedad === "Crítica" ? "danger" : "warning"}"></span>
                      <div><strong>${escapeHtml(alert.empresa)}</strong><small>${escapeHtml(alert.mensaje)}</small></div>
                      <span class="badge ${badgeClass(alert.gravedad)}">${escapeHtml(alert.gravedad)}</span>
                    </li>`,
                )
                .join("")}</ul>`
            : '<div class="empty-state compact"><span class="material-symbols-outlined">check_circle</span><p>No existen alertas activas.</p></div>'
        }
      </article>
    </section>
  `;
}

export function renderApplicationsView({ applications, metrics, zones, filters, page = 1 }) {
  const pageCount = Math.max(1, Math.ceil(applications.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), pageCount);
  const start = (safePage - 1) * PAGE_SIZE;
  const currentRows = applications.slice(start, start + PAGE_SIZE);
  const allSectors = [...new Set(zones.flatMap((zone) => zone.sectoresPermitidos || DEFAULT_SECTORS))];

  return `
    <section class="page-heading">
      <h2>Solicitudes de instalación</h2>
      <p>Administre, evalúe y audite las solicitudes recibidas por la Zona Franca.</p>
    </section>
    <section class="metrics-grid">
      ${metricCard("description", "TOTAL SOLICITUDES", metrics.total)}
      ${metricCard("check_circle", "RECOMENDADAS", metrics.recommended, "success")}
      ${metricCard("pending", "POR REVISAR", metrics.review, "warning")}
      ${metricCard("cancel", "RECHAZADAS", metrics.rejected, "danger")}
    </section>
    <section class="toolbar applications-toolbar" aria-label="Herramientas de solicitudes">
      <div class="toolbar-left">
        <label class="search">
          <span class="material-symbols-outlined" aria-hidden="true">search</span>
          <span class="sr-only">Buscar empresa</span>
          <input id="searchApplications" type="search" value="${escapeHtml(filters.search || "")}" placeholder="Buscar empresa..." />
        </label>
        <label class="compact-control"><span>Estado</span><select id="filterState">
          ${option("", filters.estado, "Todos")}
          ${Object.values(APPLICATION_STATES).map((value) => option(value, filters.estado)).join("")}
        </select></label>
        <label class="compact-control"><span>Sector</span><select id="filterSector">
          ${option("", filters.sector, "Todos")}
          ${allSectors.map((value) => option(value, filters.sector)).join("")}
        </select></label>
        <label class="compact-control"><span>Zona</span><select id="filterZone">
          ${option("", filters.zonaFrancaId, "Todas")}
          ${zones.map((zone) => option(zone.id, filters.zonaFrancaId, zone.nombre)).join("")}
        </select></label>
        <label class="compact-control"><span>Fecha</span><input id="filterDate" type="date" value="${escapeHtml(filters.fecha || "")}" /></label>
        <button type="button" class="clear-btn" data-action="clear-filters">Limpiar filtros</button>
      </div>
      <div class="toolbar-actions-group">
        <button type="button" class="secondary-btn compact-btn" data-action="process-pending">
          <span class="material-symbols-outlined" aria-hidden="true">auto_awesome</span>Procesar pendientes (${metrics.pending})
        </button>
        <button type="button" class="new-btn" data-action="new-application">
          <span class="material-symbols-outlined" aria-hidden="true">add</span>Nueva solicitud
        </button>
      </div>
    </section>
    <section class="table-card">
      <div class="table-wrap">
        <table>
          <thead><tr><th>EMPRESA</th><th>SECTOR</th><th>INVERSIÓN<br>PROYECTADA</th><th>EMPLEOS</th><th>PUNTAJE<br>IA</th><th>ESTADO</th><th>FECHA</th><th>ACCIÓN</th></tr></thead>
          <tbody>
            ${
              currentRows.length
                ? currentRows.map(applicationRow).join("")
                : '<tr><td colspan="8"><div class="empty-state compact"><span class="material-symbols-outlined">search_off</span><p>No hay solicitudes que coincidan con los filtros.</p></div></td></tr>'
            }
          </tbody>
        </table>
      </div>
      <footer class="table-footer">
        <p>Mostrando <b>${applications.length ? start + 1 : 0}</b> a <b>${Math.min(start + PAGE_SIZE, applications.length)}</b> de <b>${applications.length}</b> resultados</p>
        <div class="pagination" aria-label="Paginación">
          <button type="button" data-page="${safePage - 1}" ${safePage === 1 ? "disabled" : ""} aria-label="Página anterior"><span class="material-symbols-outlined">chevron_left</span></button>
          ${Array.from({ length: pageCount }, (_, index) => index + 1)
            .map((number) => `<button type="button" data-page="${number}" class="${number === safePage ? "active-page" : ""}" aria-label="Página ${number}">${number}</button>`)
            .join("")}
          <button type="button" data-page="${safePage + 1}" ${safePage === pageCount ? "disabled" : ""} aria-label="Página siguiente"><span class="material-symbols-outlined">chevron_right</span></button>
        </div>
      </footer>
    </section>
  `;
}

function applicationRow(application) {
  const displayedState = application.clasificacionFinal || application.clasificacionIA || application.estado;
  const score = application.puntajeIA;
  return `
    <tr>
      <td class="company">${escapeHtml(application.empresa)}</td>
      <td>${escapeHtml(application.sector)}</td>
      <td>${formatCurrency(application.inversionProyectada)}</td>
      <td>${escapeHtml(application.empleosProyectados)} empleos</td>
      <td>${score === null || score === undefined ? '<span class="muted-value">Pendiente</span>' : `<div class="score ${scoreClass(score)}">${escapeHtml(score)}</div><span class="score-total">/100</span>`}</td>
      <td><span class="badge ${badgeClass(displayedState)}">${escapeHtml(displayedState).toUpperCase()}</span></td>
      <td>${formatDate(application.fechaCreacion)}</td>
      <td><button type="button" class="detail-link button-link" data-action="view-application" data-id="${escapeHtml(application.id)}">Ver detalle</button></td>
    </tr>
  `;
}

export function renderComplianceView(data, metrics) {
  return `
    <section class="page-heading page-heading-actions">
      <div><h2>Cumplimiento empresarial</h2><p>Compare reportes trimestrales con los compromisos aprobados.</p></div>
      <button type="button" class="new-btn" data-action="new-report"><span class="material-symbols-outlined">add</span>Nuevo reporte</button>
    </section>
    <section class="metrics-grid">
      ${metricCard("factory", "EMPRESAS INSTALADAS", metrics.empresas)}
      ${metricCard("task_alt", "REPORTES EN REGLA", metrics.enRegla, "success")}
      ${metricCard("warning", "ALERTAS PREVENTIVAS", metrics.preventivas, "warning")}
      ${metricCard("error", "ALERTAS CRÍTICAS", metrics.criticas, "danger")}
    </section>
    <section class="table-card">
      <div class="section-title table-title"><div><h3>Reportes recibidos</h3><p>Resumen administrativo simulado para PROCOMER.</p></div></div>
      <div class="table-wrap"><table class="wide-data-table">
        <thead><tr><th>EMPRESA</th><th>PERIODO</th><th>INVERSIÓN</th><th>EMPLEO</th><th>EXPORTACIONES</th><th>ESTADO</th><th>FECHA</th><th>HISTORIAL</th></tr></thead>
        <tbody>${
          data.reports.length
            ? data.reports.map((report) => `
              <tr><td class="company">${escapeHtml(report.empresa)}</td><td>${escapeHtml(report.periodo)}</td>
              <td>${formatPercentage(report.porcentajes.inversion)}</td><td>${formatPercentage(report.porcentajes.empleos)}</td>
              <td>${formatCurrency(report.exportaciones)}</td><td><span class="badge ${badgeClass(report.estado)}">${escapeHtml(report.estado)}</span></td>
              <td>${formatDate(report.fechaCreacion)}</td><td><button type="button" class="button-link detail-link" data-action="view-company-history" data-id="${escapeHtml(report.empresaId)}">Ver historial</button></td></tr>`).join("")
            : '<tr><td colspan="8"><div class="empty-state compact"><span class="material-symbols-outlined">inbox</span><p>No existen reportes de cumplimiento.</p></div></td></tr>'
        }</tbody>
      </table></div>
    </section>
  `;
}

export function renderAlertsView(data) {
  const active = data.alerts.filter((alert) => alert.estado === "Activa");
  return `
    <section class="page-heading"><h2>Alertas de incumplimiento</h2><p>Revise desviaciones preventivas y críticas generadas automáticamente.</p></section>
    <section class="table-card">
      <div class="section-title table-title"><div><h3>Alertas registradas</h3><p>${active.length} alerta(s) requieren seguimiento.</p></div></div>
      <div class="table-wrap"><table class="wide-data-table">
        <thead><tr><th>EMPRESA</th><th>INDICADOR</th><th>CUMPLIMIENTO</th><th>GRAVEDAD</th><th>MENSAJE</th><th>ESTADO</th><th>FECHA</th><th>ACCIÓN</th></tr></thead>
        <tbody>${
          data.alerts.length
            ? data.alerts.map((alert) => `
              <tr><td class="company">${escapeHtml(alert.empresa)}</td><td>${escapeHtml(alert.indicador)}</td>
              <td>${formatPercentage(alert.porcentaje)}</td><td><span class="badge ${badgeClass(alert.gravedad)}">${escapeHtml(alert.gravedad)}</span></td>
              <td>${escapeHtml(alert.mensaje)}</td><td><span class="badge ${badgeClass(alert.estado)}">${escapeHtml(alert.estado)}</span></td>
              <td>${formatDate(alert.fecha)}</td><td>${alert.estado === "Activa" ? `<button type="button" class="button-link detail-link" data-action="resolve-alert" data-id="${escapeHtml(alert.id)}">Marcar resuelta</button>` : '<span class="muted-value">Finalizada</span>'}</td></tr>`).join("")
            : '<tr><td colspan="8"><div class="empty-state compact"><span class="material-symbols-outlined">notifications_off</span><p>No existen alertas registradas.</p></div></td></tr>'
        }</tbody>
      </table></div>
    </section>
  `;
}

export function renderZoneView(zone, sectors = DEFAULT_SECTORS) {
  const selected = new Set(zone.sectoresPermitidos || []);
  return `
    <section class="page-heading"><h2>Configuración de Zona Franca</h2><p>Criterios académicos utilizados por el motor de evaluación.</p></section>
    <section class="content-card form-card">
      <form id="zoneForm" novalidate>
        <div class="form-grid">
          <label class="form-field full"><span>Nombre de la zona franca</span><input name="nombre" value="${escapeHtml(zone.nombre)}" required /></label>
          <label class="form-field"><span>Inversión mínima (USD)</span><input name="inversionMinima" type="number" min="1" step="1" value="${escapeHtml(zone.inversionMinima)}" required /></label>
          <label class="form-field"><span>Empleos mínimos</span><input name="empleosMinimos" type="number" min="1" step="1" value="${escapeHtml(zone.empleosMinimos)}" required /></label>
          <fieldset class="form-field full checkbox-field"><legend>Sectores permitidos</legend>
            <div class="checkbox-grid">${sectors.map((sector) => `<label><input type="checkbox" name="sectoresPermitidos" value="${escapeHtml(sector)}" ${selected.has(sector) ? "checked" : ""}/><span>${escapeHtml(sector)}</span></label>`).join("")}</div>
          </fieldset>
        </div>
        <div class="form-note"><span class="material-symbols-outlined">info</span><p>Estos valores son supuestos académicos y no representan políticas oficiales de Zona Franca Coyol.</p></div>
        <div class="form-actions"><button type="submit" class="primary-btn"><span class="material-symbols-outlined">save</span>Guardar configuración</button></div>
      </form>
    </section>
  `;
}

export function applicationFormTemplate(zone) {
  return `
    <form id="applicationForm" novalidate>
      <div class="form-grid">
        <label class="form-field full"><span>Nombre legal de la empresa</span><input name="empresa" autocomplete="organization" required /></label>
        <label class="form-field"><span>Identificación jurídica</span><input name="identificacionJuridica" placeholder="3-101-000000" required /></label>
        <label class="form-field"><span>Sector</span><select name="sector" required><option value="">Seleccione un sector</option>${(zone.sectoresPermitidos || DEFAULT_SECTORS).map((sector) => option(sector, "")).join("")}</select></label>
        <label class="form-field"><span>Representante</span><input name="representante" autocomplete="name" required /></label>
        <label class="form-field"><span>Correo de contacto</span><input name="correo" type="email" autocomplete="email" required /></label>
        <label class="form-field"><span>Inversión proyectada (USD)</span><input name="inversionProyectada" type="number" min="0" step="1" required /></label>
        <label class="form-field"><span>Empleos proyectados</span><input name="empleosProyectados" type="number" min="0" step="1" required /></label>
        <label class="form-field full"><span>Documentos declarados</span><textarea name="documentos" rows="3" placeholder="Permiso sanitario, estudio financiero, personería jurídica" required></textarea><small>Separe las referencias con comas. No se cargan archivos reales.</small></label>
      </div>
      <div class="modal-actions"><button type="button" class="secondary-btn" data-modal-close-form>Cancelar</button><button type="submit" class="primary-btn"><span class="material-symbols-outlined">send</span>Enviar solicitud</button></div>
    </form>
  `;
}

export function applicationDetailTemplate(bundle, session) {
  const { application, evaluations, history, company } = bundle;
  const evaluation = evaluations[0];
  const canDecide = evaluation && ![APPLICATION_STATES.APPROVED, APPLICATION_STATES.REJECTED].includes(application.estado);
  const canDelete = application.estado !== APPLICATION_STATES.APPROVED;

  return `
    <div class="detail-grid">
      <section class="detail-card"><h3>Datos empresariales</h3><dl class="detail-list">
        <div><dt>Empresa</dt><dd>${escapeHtml(application.empresa)}</dd></div><div><dt>Identificación</dt><dd>${escapeHtml(application.identificacionJuridica)}</dd></div>
        <div><dt>Sector</dt><dd>${escapeHtml(application.sector)}</dd></div><div><dt>Estado</dt><dd><span class="badge ${badgeClass(application.estado)}">${escapeHtml(application.estado)}</span></dd></div>
        <div><dt>Inversión</dt><dd>${formatCurrency(application.inversionProyectada)}</dd></div><div><dt>Empleos</dt><dd>${escapeHtml(application.empleosProyectados)}</dd></div>
        <div><dt>Representante</dt><dd>${escapeHtml(application.representante)}</dd></div><div><dt>Fecha</dt><dd>${formatDate(application.fechaCreacion, { includeTime: true })}</dd></div>
      </dl></section>
      <section class="detail-card"><h3>Evaluación de IA</h3>${
        evaluation
          ? `<div class="evaluation-result"><div class="score score-large ${scoreClass(evaluation.puntaje)}">${escapeHtml(evaluation.puntaje)}</div><div><span class="badge ${badgeClass(evaluation.clasificacion)}">${escapeHtml(evaluation.clasificacion)}</span><p>${escapeHtml(evaluation.justificacion)}</p></div></div>`
          : '<div class="empty-state compact"><span class="material-symbols-outlined">hourglass_empty</span><p>La solicitud todavía no ha sido evaluada.</p></div>'
      }</section>
    </div>
    <section class="detail-card"><h3>Documentos declarados</h3><ul class="document-list">${application.documentos.map((document) => `<li><span class="material-symbols-outlined">description</span><span>${escapeHtml(document.nombre || document)}</span><small>${escapeHtml(document.tipo || "Referencia")}</small></li>`).join("")}</ul></section>
    ${
      canDecide
        ? `<section class="detail-card"><h3>Decisión del analista</h3><form id="decisionForm" data-id="${escapeHtml(application.id)}" novalidate><div class="form-grid">
            <label class="form-field"><span>Clasificación final</span><select name="clasificacionFinal">${Object.values(AI_CLASSIFICATIONS).map((value) => option(value, evaluation.clasificacion)).join("")}</select></label>
            <label class="form-field"><span>Responsable</span><input name="responsable" value="${escapeHtml(session.nombre)}" required /></label>
            <label class="form-field full"><span>Justificación</span><textarea name="justificacion" rows="3" placeholder="Obligatoria si cambia la sugerencia de IA"></textarea></label>
          </div><div class="form-actions"><button type="submit" class="primary-btn">Guardar decisión</button></div></form></section>`
        : application.decisionAnalista
          ? `<section class="detail-card"><h3>Decisión final</h3><p><span class="badge ${badgeClass(application.clasificacionFinal)}">${escapeHtml(application.clasificacionFinal)}</span></p><p>${escapeHtml(application.decisionAnalista.justificacion)}</p><small>${escapeHtml(application.decisionAnalista.responsable)} · ${formatDate(application.decisionAnalista.fecha, { includeTime: true })}</small></section>`
          : ""
    }
    <div class="modal-actions spread">
      <div>${application.estado === APPLICATION_STATES.PENDING ? `<button type="button" class="secondary-btn" data-action="evaluate-one" data-id="${escapeHtml(application.id)}">Evaluar con IA</button>` : ""}${company ? `<button type="button" class="secondary-btn" data-action="view-company-history" data-id="${escapeHtml(company.id)}">Historial empresarial</button>` : ""}</div>
      <div>${canDelete ? `<button type="button" class="danger-btn ghost" data-action="delete-application" data-id="${escapeHtml(application.id)}">Eliminar solicitud</button>` : ""}</div>
    </div>
    ${history.length ? `<details class="audit-preview"><summary>Últimos movimientos (${history.length})</summary><ul>${history.slice(0, 5).map((entry) => `<li><strong>${escapeHtml(entry.tipo)}</strong><span>${escapeHtml(entry.valorNuevo || "Actualización")}</span><small>${formatDate(entry.fecha, { includeTime: true })}</small></li>`).join("")}</ul></details>` : ""}
  `;
}

export function reportFormTemplate(companies) {
  return `
    <form id="reportForm" novalidate><div class="form-grid">
      <label class="form-field full"><span>Empresa instalada</span><select name="empresaId" required><option value="">Seleccione una empresa</option>${companies.map((company) => option(company.id, "", company.nombre)).join("")}</select></label>
      <label class="form-field"><span>Periodo trimestral</span><input name="periodo" placeholder="2026-T3" pattern="[0-9]{4}-T[1-4]" required /></label>
      <label class="form-field"><span>Inversión ejecutada (USD)</span><input name="inversionEjecutada" type="number" min="0" step="1" required /></label>
      <label class="form-field"><span>Empleos reales</span><input name="empleosReales" type="number" min="0" step="1" required /></label>
      <label class="form-field"><span>Exportaciones (USD)</span><input name="exportaciones" type="number" min="0" step="1" required /></label>
      <label class="form-field full"><span>Observaciones</span><textarea name="observaciones" rows="3"></textarea></label>
    </div><div class="modal-actions"><button type="button" class="secondary-btn" data-modal-close-form>Cancelar</button><button type="submit" class="primary-btn">Procesar reporte</button></div></form>
  `;
}

export function historyTemplate(events) {
  return events.length
    ? `<ol class="timeline">${events.map((event) => `<li><span class="timeline-marker"></span><div><span class="badge badge-neutral">${escapeHtml(event.tipo)}</span><h3>${escapeHtml(event.titulo)}</h3><p>${escapeHtml(event.detalle)}</p><small>${escapeHtml(event.responsable || "Sistema")} · ${formatDate(event.fecha, { includeTime: true })}</small></div></li>`).join("")}</ol>`
    : '<div class="empty-state"><span class="material-symbols-outlined">history</span><p>No existen movimientos para mostrar.</p></div>';
}

export function loginTemplate() {
  return `
    <p class="information-message">Seleccione una identidad académica para continuar. Esta sesión no representa autenticación productiva.</p>
    <form id="loginForm" novalidate><div class="form-grid single">
      <label class="form-field"><span>Nombre</span><input name="nombre" value="María González" required /></label>
      <label class="form-field"><span>Rol</span><select name="rol">${["Analista de solicitudes", "Analista de cumplimiento", "Administrador", "Gerencia"].map((role) => option(role, "Analista de solicitudes")).join("")}</select></label>
    </div><div class="modal-actions"><button type="submit" class="primary-btn">Ingresar al prototipo</button></div></form>
  `;
}

export function helpTemplate() {
  return `
    <div class="help-content"><p>ZoFranca CR es una simulación académica. Utilice la navegación lateral para:</p><ul>
      <li>Registrar y evaluar solicitudes.</li><li>Confirmar decisiones humanas.</li><li>Procesar reportes de cumplimiento.</li>
      <li>Revisar alertas e historial.</li><li>Configurar los criterios académicos de la zona.</li>
    </ul><div class="form-note"><span class="material-symbols-outlined">dns</span><p>Para guardar información, json-server debe ejecutarse en <strong>http://localhost:3001</strong>.</p></div></div>
  `;
}

