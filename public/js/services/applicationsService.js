import {
  ACTIVE_APPLICATION_STATES,
  AI_CLASSIFICATIONS,
  APPLICATION_STATES,
  RESOURCES,
} from "../config.js";
import { normalizeText } from "../businessRules.js";
import { validateApplication, validateDecision } from "../validators.js";
import { api } from "./api.js";
import { recordAuditEvent } from "./auditService.js";

function sameId(left, right) {
  return String(left ?? "") === String(right ?? "");
}

export async function getApplications({ includeDeleted = false } = {}) {
  const applications = await api.list(RESOURCES.applications);
  return includeDeleted ? applications : applications.filter((application) => !application.eliminada);
}

export function filterApplications(applications, filters = {}) {
  const search = normalizeText(filters.search);
  return applications.filter((application) => {
    const matchesSearch =
      !search ||
      [application.empresa, application.identificacionJuridica, application.representante]
        .map(normalizeText)
        .some((value) => value.includes(search));
    const matchesState = !filters.estado || application.estado === filters.estado;
    const matchesSector = !filters.sector || application.sector === filters.sector;
    const matchesZone = !filters.zonaFrancaId || sameId(application.zonaFrancaId, filters.zonaFrancaId);
    const matchesDate =
      !filters.fecha || String(application.fechaCreacion || "").slice(0, 10) === filters.fecha;

    return matchesSearch && matchesState && matchesSector && matchesZone && matchesDate;
  });
}

export async function createApplication(input, zoneId) {
  const validApplication = validateApplication(input);
  const applications = await getApplications();
  const normalizedId = normalizeText(validApplication.identificacionJuridica);
  const duplicate = applications.find(
    (application) =>
      normalizeText(application.identificacionJuridica) === normalizedId &&
      ACTIVE_APPLICATION_STATES.includes(application.estado),
  );

  if (duplicate) {
    throw new Error("Ya existe una solicitud activa con esa identificación jurídica.");
  }

  const now = new Date().toISOString();
  const documents = validApplication.documentos.map((document, index) => {
    if (typeof document === "string") {
      return { nombre: document.trim(), tipo: "Referencia", referencia: `DOC-${index + 1}` };
    }
    return {
      nombre: String(document.nombre).trim(),
      tipo: document.tipo || "Referencia",
      referencia: document.referencia || `DOC-${index + 1}`,
    };
  });

  const application = await api.create(RESOURCES.applications, {
    ...validApplication,
    documentos: documents,
    zonaFrancaId: String(zoneId),
    estado: APPLICATION_STATES.PENDING,
    puntajeIA: null,
    clasificacionIA: null,
    clasificacionFinal: null,
    eliminada: false,
    fechaCreacion: now,
    fechaActualizacion: now,
  });

  await recordAuditEvent({
    tipo: "Creación",
    entidad: "Solicitud",
    entidadId: application.id,
    solicitudId: application.id,
    valorNuevo: APPLICATION_STATES.PENDING,
    responsable: validApplication.representante,
    justificacion: "Solicitud enviada mediante el formulario web.",
  });

  return application;
}

export async function getApplicationBundle(applicationId) {
  const [application, evaluations, history, companies] = await Promise.all([
    api.get(RESOURCES.applications, applicationId),
    api.list(RESOURCES.evaluations),
    api.list(RESOURCES.history),
    api.list(RESOURCES.companies),
  ]);

  return {
    application,
    evaluations: evaluations
      .filter((evaluation) => sameId(evaluation.solicitudId, applicationId))
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha)),
    history: history
      .filter((entry) => sameId(entry.solicitudId, applicationId))
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha)),
    company: companies.find((company) => sameId(company.solicitudId, applicationId)) || null,
  };
}

function stateFromClassification(classification) {
  if (classification === AI_CLASSIFICATIONS.RECOMMENDED) return APPLICATION_STATES.APPROVED;
  if (classification === AI_CLASSIFICATIONS.REVIEW) return APPLICATION_STATES.IN_REVIEW;
  return APPLICATION_STATES.REJECTED;
}

export async function saveHumanDecision(applicationId, input) {
  const bundle = await getApplicationBundle(applicationId);
  const evaluation = bundle.evaluations[0];
  if (!evaluation) throw new Error("La solicitud debe evaluarse antes de registrar una decisión.");

  const decision = validateDecision(input, evaluation.clasificacion);
  const newState = stateFromClassification(decision.clasificacionFinal);
  const now = new Date().toISOString();

  const updated = await api.patch(RESOURCES.applications, applicationId, {
    estado: newState,
    clasificacionFinal: decision.clasificacionFinal,
    decisionAnalista: {
      responsable: decision.responsable,
      justificacion: decision.justificacion || "Clasificación sugerida confirmada.",
      fecha: now,
    },
    fechaDecision: now,
    fechaActualizacion: now,
  });

  await recordAuditEvent({
    tipo: "Decisión humana",
    entidad: "Solicitud",
    entidadId: applicationId,
    solicitudId: applicationId,
    valorAnterior: bundle.application.estado,
    valorNuevo: newState,
    responsable: decision.responsable,
    justificacion: decision.justificacion || "Clasificación sugerida confirmada por el analista.",
  });

  if (newState === APPLICATION_STATES.APPROVED && !bundle.company) {
    const company = await api.create(RESOURCES.companies, {
      solicitudId: String(applicationId),
      zonaFrancaId: String(bundle.application.zonaFrancaId),
      nombre: bundle.application.empresa,
      identificacionJuridica: bundle.application.identificacionJuridica,
      compromisos: {
        inversion: bundle.application.inversionProyectada,
        empleos: bundle.application.empleosProyectados,
      },
      fechaInstalacion: now,
      estado: "Instalada",
    });

    await recordAuditEvent({
      tipo: "Instalación académica",
      entidad: "Empresa",
      entidadId: company.id,
      solicitudId: applicationId,
      empresaId: company.id,
      valorNuevo: "Instalada",
      responsable: decision.responsable,
      justificacion: "Creada a partir de una solicitud aprobada.",
    });
  }

  return updated;
}

export async function softDeleteApplication(applicationId, responsible) {
  const application = await api.get(RESOURCES.applications, applicationId);
  if (application.estado === APPLICATION_STATES.APPROVED) {
    throw new Error("Una solicitud aprobada no puede eliminarse porque forma parte de la trazabilidad.");
  }

  const now = new Date().toISOString();
  const updated = await api.patch(RESOURCES.applications, applicationId, {
    eliminada: true,
    eliminadaPor: responsible,
    fechaEliminacion: now,
    fechaActualizacion: now,
  });

  await recordAuditEvent({
    tipo: "Eliminación lógica",
    entidad: "Solicitud",
    entidadId: applicationId,
    solicitudId: applicationId,
    valorAnterior: application.estado,
    valorNuevo: "Oculta",
    responsable: responsible,
    justificacion: "La solicitud se ocultó sin eliminar su trazabilidad del backend.",
  });

  return updated;
}

