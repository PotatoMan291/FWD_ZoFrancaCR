export const API_BASE_URL = globalThis.ZOFRANCA_API_URL || "http://localhost:3001";

export const RESOURCES = Object.freeze({
  zones: "zonasFrancas",
  applications: "solicitudes",
  evaluations: "evaluaciones",
  companies: "empresas",
  reports: "reportesCumplimiento",
  alerts: "alertas",
  history: "historialDecisiones",
});

export const DEFAULT_ZONE_ID = "1";
export const PAGE_SIZE = 10;

export const APPLICATION_STATES = Object.freeze({
  DRAFT: "Borrador",
  PENDING: "Pendiente",
  EVALUATED: "Evaluada",
  IN_REVIEW: "En revisión",
  APPROVED: "Aprobada",
  REJECTED: "Rechazada",
});

export const AI_CLASSIFICATIONS = Object.freeze({
  RECOMMENDED: "Recomendada",
  REVIEW: "Revisar",
  REJECTED: "Rechazada",
});

export const ALERT_LEVELS = Object.freeze({
  OK: "En regla",
  PREVENTIVE: "Preventiva",
  CRITICAL: "Crítica",
});

export const ACTIVE_APPLICATION_STATES = Object.freeze([
  APPLICATION_STATES.DRAFT,
  APPLICATION_STATES.PENDING,
  APPLICATION_STATES.EVALUATED,
  APPLICATION_STATES.IN_REVIEW,
  APPLICATION_STATES.APPROVED,
]);

export const DEFAULT_SECTORS = Object.freeze([
  "Ciencias de la vida",
  "Dispositivos médicos",
  "Manufactura inteligente",
  "Semiconductores",
  "Servicios especializados",
]);

export const REQUEST_TIMEOUT_MS = 8000;
export const AI_LATENCY_MS = 900;

