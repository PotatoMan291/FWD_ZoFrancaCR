import { ALERT_LEVELS, RESOURCES } from "../config.js";
import { calculateCompliance } from "../businessRules.js";
import { validateReport } from "../validators.js";
import { api } from "./api.js";
import { recordAuditEvent } from "./auditService.js";

function sameId(left, right) {
  return String(left ?? "") === String(right ?? "");
}

export async function getCompanies() {
  return api.list(RESOURCES.companies);
}

export async function getReports() {
  return api.list(RESOURCES.reports);
}

export async function getAlerts() {
  return api.list(RESOURCES.alerts);
}

export async function createComplianceReport(input, responsible) {
  const reportInput = validateReport(input);
  const company = await api.get(RESOURCES.companies, reportInput.empresaId);
  if (company.estado !== "Instalada") {
    throw new Error("Solo las empresas instaladas pueden presentar reportes de cumplimiento.");
  }

  const reports = await getReports();
  const duplicate = reports.find(
    (report) => sameId(report.empresaId, company.id) && report.periodo === reportInput.periodo,
  );
  if (duplicate) throw new Error("La empresa ya presentó un reporte para ese periodo.");

  const calculation = calculateCompliance(reportInput, company.compromisos);
  const now = new Date().toISOString();
  const report = await api.create(RESOURCES.reports, {
    ...reportInput,
    ...calculation,
    responsable: responsible,
    fechaCreacion: now,
  });

  const alerts = await Promise.all(
    calculation.desviaciones.map((deviation) =>
      api.create(RESOURCES.alerts, {
        reporteId: String(report.id),
        empresaId: String(company.id),
        indicador: deviation.indicador,
        porcentaje: deviation.porcentaje,
        gravedad: deviation.gravedad,
        mensaje: `${deviation.indicador} registra ${deviation.porcentaje}% del compromiso para ${report.periodo}.`,
        estado: "Activa",
        fecha: now,
      }),
    ),
  );

  await recordAuditEvent({
    tipo: "Reporte de cumplimiento",
    entidad: "Reporte",
    entidadId: report.id,
    solicitudId: company.solicitudId,
    empresaId: company.id,
    valorNuevo: calculation.estado,
    responsable: responsible,
    justificacion: `Reporte ${report.periodo} procesado con ${alerts.length} alerta(s).`,
  });

  return { report, alerts };
}

export async function resolveAlert(alertId, responsible) {
  const alert = await api.get(RESOURCES.alerts, alertId);
  if (alert.estado === "Resuelta") return alert;
  const now = new Date().toISOString();
  const updated = await api.patch(RESOURCES.alerts, alertId, {
    estado: "Resuelta",
    resueltaPor: responsible,
    fechaResolucion: now,
  });

  await recordAuditEvent({
    tipo: "Resolución de alerta",
    entidad: "Alerta",
    entidadId: alertId,
    empresaId: alert.empresaId,
    valorAnterior: "Activa",
    valorNuevo: "Resuelta",
    responsable: responsible,
    justificacion: `Alerta ${alert.indicador} revisada por el analista.`,
  });

  return updated;
}

export async function getComplianceData() {
  const [companies, reports, alerts] = await Promise.all([
    getCompanies(),
    getReports(),
    getAlerts(),
  ]);
  const companyMap = new Map(companies.map((company) => [String(company.id), company]));

  return {
    companies,
    reports: reports
      .map((report) => ({ ...report, empresa: companyMap.get(String(report.empresaId))?.nombre || "Empresa" }))
      .sort((a, b) => new Date(b.fechaCreacion) - new Date(a.fechaCreacion)),
    alerts: alerts
      .map((alert) => ({ ...alert, empresa: companyMap.get(String(alert.empresaId))?.nombre || "Empresa" }))
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha)),
  };
}

export function summarizeCompliance(data) {
  const activeAlerts = data.alerts.filter((alert) => alert.estado === "Activa");
  return {
    empresas: data.companies.length,
    reportes: data.reports.length,
    enRegla: data.reports.filter((report) => report.estado === ALERT_LEVELS.OK).length,
    preventivas: activeAlerts.filter((alert) => alert.gravedad === ALERT_LEVELS.PREVENTIVE).length,
    criticas: activeAlerts.filter((alert) => alert.gravedad === ALERT_LEVELS.CRITICAL).length,
  };
}

