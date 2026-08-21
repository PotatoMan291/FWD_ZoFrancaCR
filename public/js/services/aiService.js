import { AI_LATENCY_MS, APPLICATION_STATES, RESOURCES } from "../config.js";
import { evaluateProfile } from "../businessRules.js";
import { api } from "./api.js";
import { recordAuditEvent } from "./auditService.js";
import { getCurrentZone } from "./zonesService.js";

function wait(milliseconds) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds));
}

export async function evaluateApplication(applicationId, zone = null) {
  const application = await api.get(RESOURCES.applications, applicationId);
  if (application.estado !== APPLICATION_STATES.PENDING) {
    throw new Error(`La solicitud ${application.empresa} ya fue procesada o no está pendiente.`);
  }

  const activeZone = zone || (await getCurrentZone());
  await wait(AI_LATENCY_MS);
  const result = evaluateProfile(application, activeZone);
  const now = new Date().toISOString();

  const evaluation = await api.create(RESOURCES.evaluations, {
    solicitudId: String(application.id),
    zonaFrancaId: String(activeZone.id),
    ...result,
    fecha: now,
    motor: "IA simulada determinista v1.0",
  });

  await api.patch(RESOURCES.applications, application.id, {
    estado: APPLICATION_STATES.EVALUATED,
    puntajeIA: result.puntaje,
    clasificacionIA: result.clasificacion,
    evaluacionId: String(evaluation.id),
    fechaEvaluacion: now,
    fechaActualizacion: now,
  });

  await recordAuditEvent({
    tipo: "Evaluación IA",
    entidad: "Solicitud",
    entidadId: application.id,
    solicitudId: application.id,
    valorAnterior: APPLICATION_STATES.PENDING,
    valorNuevo: result.clasificacion,
    responsable: "Motor IA simulado",
    justificacion: result.justificacion,
  });

  return { application, evaluation };
}

export async function processPendingApplications() {
  const [applications, zone] = await Promise.all([
    api.list(RESOURCES.applications),
    getCurrentZone(),
  ]);
  const pending = applications.filter(
    (application) => !application.eliminada && application.estado === APPLICATION_STATES.PENDING,
  );

  if (!pending.length) throw new Error("No existen solicitudes pendientes para evaluar.");

  return Promise.all(pending.map((application) => evaluateApplication(application.id, zone)));
}

