import { DEFAULT_ZONE_ID, RESOURCES } from "../config.js";
import { validateZone } from "../validators.js";
import { api } from "./api.js";
import { recordAuditEvent } from "./auditService.js";

export async function getZones() {
  return api.list(RESOURCES.zones);
}

export async function getCurrentZone() {
  try {
    return await api.get(RESOURCES.zones, DEFAULT_ZONE_ID);
  } catch (error) {
    if (error.status !== 404) throw error;
    const zones = await getZones();
    if (!zones.length) throw new Error("No existe una configuración de zona franca.");
    return zones[0];
  }
}

export async function saveZone(input, responsible) {
  const validZone = validateZone(input);
  const currentDate = new Date().toISOString();
  let previous = null;

  try {
    previous = await getCurrentZone();
  } catch (error) {
    if (error.status !== 404 && !/No existe/.test(error.message)) throw error;
  }

  const payload = {
    ...validZone,
    fechaActualizacion: currentDate,
    actualizadoPor: responsible,
  };

  const saved = previous
    ? await api.patch(RESOURCES.zones, previous.id, payload)
    : await api.create(RESOURCES.zones, { id: DEFAULT_ZONE_ID, ...payload });

  await recordAuditEvent({
    tipo: "Configuración",
    entidad: "Zona franca",
    entidadId: saved.id,
    valorAnterior: previous?.nombre || null,
    valorNuevo: saved.nombre,
    responsable: responsible,
    justificacion: "Actualización de criterios académicos de evaluación.",
  });

  return saved;
}

