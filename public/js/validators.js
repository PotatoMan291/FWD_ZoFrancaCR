export class ValidationError extends Error {
  constructor(message, fields = {}) {
    super(message);
    this.name = "ValidationError";
    this.fields = fields;
  }
}

export function cleanText(value) {
  return String(value ?? "").trim();
}

export function toFiniteNumber(value) {
  const number = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  return Number.isFinite(number) ? number : Number.NaN;
}

function requireText(value, field, label, errors) {
  const text = cleanText(value);
  if (!text) errors[field] = `${label} es obligatorio.`;
  return text;
}

function requireNonNegative(value, field, label, errors, { greaterThanZero = false } = {}) {
  const number = toFiniteNumber(value);
  if (!Number.isFinite(number) || number < 0 || (greaterThanZero && number === 0)) {
    errors[field] = `${label} debe ser un número ${greaterThanZero ? "mayor que cero" : "no negativo"}.`;
  }
  return number;
}

function throwIfInvalid(errors) {
  const messages = Object.values(errors);
  if (messages.length) throw new ValidationError(messages[0], errors);
}

export function validateZone(input) {
  const errors = {};
  const zone = {
    nombre: requireText(input.nombre, "nombre", "El nombre", errors),
    inversionMinima: requireNonNegative(
      input.inversionMinima,
      "inversionMinima",
      "La inversión mínima",
      errors,
      { greaterThanZero: true },
    ),
    empleosMinimos: requireNonNegative(
      input.empleosMinimos,
      "empleosMinimos",
      "Los empleos mínimos",
      errors,
      { greaterThanZero: true },
    ),
    sectoresPermitidos: Array.isArray(input.sectoresPermitidos)
      ? input.sectoresPermitidos.map(cleanText).filter(Boolean)
      : [],
  };

  if (!zone.sectoresPermitidos.length) {
    errors.sectoresPermitidos = "Seleccione al menos un sector permitido.";
  }

  throwIfInvalid(errors);
  return zone;
}

export function validateApplication(input) {
  const errors = {};
  const email = requireText(input.correo, "correo", "El correo", errors);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.correo = "Ingrese un correo electrónico válido.";
  }

  const application = {
    empresa: requireText(input.empresa, "empresa", "El nombre legal", errors),
    identificacionJuridica: requireText(
      input.identificacionJuridica,
      "identificacionJuridica",
      "La identificación jurídica",
      errors,
    ),
    representante: requireText(input.representante, "representante", "El representante", errors),
    correo: email,
    sector: requireText(input.sector, "sector", "El sector", errors),
    inversionProyectada: requireNonNegative(
      input.inversionProyectada,
      "inversionProyectada",
      "La inversión proyectada",
      errors,
      { greaterThanZero: true },
    ),
    empleosProyectados: requireNonNegative(
      input.empleosProyectados,
      "empleosProyectados",
      "Los empleos proyectados",
      errors,
      { greaterThanZero: true },
    ),
    documentos: Array.isArray(input.documentos)
      ? input.documentos.filter((document) => cleanText(document.nombre || document))
      : [],
  };

  if (!application.documentos.length) {
    errors.documentos = "Declare al menos un documento de respaldo.";
  }

  throwIfInvalid(errors);
  return application;
}

export function validateDecision(input, suggestedClassification = "") {
  const errors = {};
  const clasificacionFinal = requireText(
    input.clasificacionFinal,
    "clasificacionFinal",
    "La clasificación final",
    errors,
  );
  const responsable = requireText(input.responsable, "responsable", "El responsable", errors);
  const justificacion = cleanText(input.justificacion);

  if (clasificacionFinal !== suggestedClassification && justificacion.length < 10) {
    errors.justificacion = "Explique el cambio con una justificación de al menos 10 caracteres.";
  }

  throwIfInvalid(errors);
  return { clasificacionFinal, responsable, justificacion };
}

export function validateReport(input) {
  const errors = {};
  const report = {
    empresaId: requireText(input.empresaId, "empresaId", "La empresa", errors),
    periodo: requireText(input.periodo, "periodo", "El periodo", errors),
    inversionEjecutada: requireNonNegative(
      input.inversionEjecutada,
      "inversionEjecutada",
      "La inversión ejecutada",
      errors,
    ),
    empleosReales: requireNonNegative(input.empleosReales, "empleosReales", "Los empleos reales", errors),
    exportaciones: requireNonNegative(input.exportaciones, "exportaciones", "Las exportaciones", errors),
    observaciones: cleanText(input.observaciones),
  };

  throwIfInvalid(errors);
  return report;
}

