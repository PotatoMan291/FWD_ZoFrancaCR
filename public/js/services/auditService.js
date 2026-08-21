import { RESOURCES } from "../config.js";
import { api } from "./api.js";

function sameId(left, right) {
  return String(left ?? "") === String(right ?? "");
}

export async function recordAuditEvent(event) {
  const entry = {
    tipo: event.tipo || "Actualización",
    entidad: event.entidad || "Sistema",
    entidadId: event.entidadId ?? null,
    solicitudId: event.solicitudId ?? null,
    empresaId: event.empresaId ?? null,
    valorAnterior: event.valorAnterior ?? null,
    valorNuevo: event.valorNuevo ?? null,
    responsable: event.responsable || "Sistema ZoFranca CR",
    justificacion: event.justificacion || "Operación registrada por el sistema.",
    detalle: event.detalle || "",
    fecha: event.fecha || new Date().toISOString(),
  };

  return api.create(RESOURCES.history, entry);
}

export async function getCompanyTimeline(companyId) {
  const company = await api.get(RESOURCES.companies, companyId);
  const [application, evaluations, reports, alerts, history] = await Promise.all([
    api.get(RESOURCES.applications, company.solicitudId),
    api.list(RESOURCES.evaluations),
    api.list(RESOURCES.reports),
    api.list(RESOURCES.alerts),
    api.list(RESOURCES.history),
  ]);

  const companyReports = reports.filter((report) => sameId(report.empresaId, company.id));
  const reportIds = new Set(companyReports.map((report) => String(report.id)));

  const events = [
    {
      tipo: "Solicitud",
      titulo: "Solicitud registrada",
      fecha: application.fechaCreacion,
      responsable: application.representante,
      detalle: `${application.empresa} ingresó una solicitud en estado ${application.estado}.`,
    },
    ...evaluations
      .filter((evaluation) => sameId(evaluation.solicitudId, application.id))
      .map((evaluation) => ({
        tipo: "Evaluación IA",
        titulo: `${evaluation.clasificacion} (${evaluation.puntaje}/100)`,
        fecha: evaluation.fecha,
        responsable: "Motor IA simulado",
        detalle: evaluation.justificacion,
      })),
    ...history
      .filter(
        (entry) => sameId(entry.solicitudId, application.id) || sameId(entry.empresaId, company.id),
      )
      .map((entry) => ({
        tipo: entry.tipo,
        titulo: entry.valorNuevo || entry.tipo,
        fecha: entry.fecha,
        responsable: entry.responsable,
        detalle: entry.justificacion || entry.detalle,
      })),
    ...companyReports.map((report) => ({
      tipo: "Cumplimiento",
      titulo: `Reporte ${report.periodo}: ${report.estado}`,
      fecha: report.fechaCreacion,
      responsable: report.responsable || company.nombre,
      detalle: `Inversión ${report.porcentajes.inversion}% y empleo ${report.porcentajes.empleos}%.`,
    })),
    ...alerts
      .filter((alert) => reportIds.has(String(alert.reporteId)))
      .map((alert) => ({
        tipo: "Alerta",
        titulo: `${alert.gravedad}: ${alert.indicador}`,
        fecha: alert.fecha,
        responsable: "Sistema ZoFranca CR",
        detalle: alert.mensaje,
      })),
  ];

  return events
    .filter((event) => event.fecha)
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
}

