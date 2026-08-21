import { AI_CLASSIFICATIONS, ALERT_LEVELS } from "./config.js";
import { toFiniteNumber } from "./validators.js";

export function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function classifyScore(score) {
  const numericScore = toFiniteNumber(score);
  if (!Number.isFinite(numericScore) || numericScore < 0 || numericScore > 100) {
    throw new Error("El puntaje debe encontrarse entre 0 y 100.");
  }
  if (numericScore >= 75) return AI_CLASSIFICATIONS.RECOMMENDED;
  if (numericScore >= 50) return AI_CLASSIFICATIONS.REVIEW;
  return AI_CLASSIFICATIONS.REJECTED;
}

export function evaluateProfile(application, zone) {
  if (!application?.sector) throw new Error("La solicitud no incluye un sector válido.");

  const investment = toFiniteNumber(application.inversionProyectada);
  const jobs = toFiniteNumber(application.empleosProyectados);
  const minimumInvestment = toFiniteNumber(zone?.inversionMinima);
  const minimumJobs = toFiniteNumber(zone?.empleosMinimos);

  if (
    ![investment, jobs, minimumInvestment, minimumJobs].every(Number.isFinite) ||
    investment < 0 ||
    jobs < 0 ||
    minimumInvestment <= 0 ||
    minimumJobs <= 0
  ) {
    throw new Error("La solicitud o la configuración contienen valores inválidos.");
  }

  const allowedSectors = (zone.sectoresPermitidos || []).map(normalizeText);
  const sectorAllowed = allowedSectors.includes(normalizeText(application.sector));
  const sectorPoints = sectorAllowed ? 40 : 0;
  const investmentPoints = Math.min(investment / minimumInvestment, 1) * 30;
  const employmentPoints = Math.min(jobs / minimumJobs, 1) * 30;
  const score = Math.round(sectorPoints + investmentPoints + employmentPoints);
  const classification = classifyScore(score);

  const justification = [
    `Sector ${sectorAllowed ? "permitido" : "no permitido"} (${sectorPoints}/40).`,
    `Inversión evaluada con ${Math.round(investmentPoints)}/30 puntos.`,
    `Empleo evaluado con ${Math.round(employmentPoints)}/30 puntos.`,
  ].join(" ");

  return {
    puntaje: score,
    clasificacion: classification,
    justificacion: justification,
    desglose: {
      sector: sectorPoints,
      inversion: Math.round(investmentPoints),
      empleos: Math.round(employmentPoints),
    },
  };
}

export function calculateCompliance(report, commitments) {
  const investmentCommitment = toFiniteNumber(commitments.inversion);
  const jobsCommitment = toFiniteNumber(commitments.empleos);
  const actualInvestment = toFiniteNumber(report.inversionEjecutada);
  const actualJobs = toFiniteNumber(report.empleosReales);

  if (
    ![investmentCommitment, jobsCommitment, actualInvestment, actualJobs].every(Number.isFinite) ||
    investmentCommitment <= 0 ||
    jobsCommitment <= 0
  ) {
    throw new Error("No existe una base de comparación válida para calcular el cumplimiento.");
  }

  const investmentPercentage = Number(((actualInvestment / investmentCommitment) * 100).toFixed(2));
  const jobsPercentage = Number(((actualJobs / jobsCommitment) * 100).toFixed(2));
  const minimumPercentage = Math.min(investmentPercentage, jobsPercentage);

  let status = ALERT_LEVELS.OK;
  if (minimumPercentage < 80) status = ALERT_LEVELS.CRITICAL;
  else if (minimumPercentage < 100) status = ALERT_LEVELS.PREVENTIVE;

  const deviations = [];
  if (investmentPercentage < 100) {
    deviations.push({ indicador: "Inversión", porcentaje: investmentPercentage, gravedad: statusFor(investmentPercentage) });
  }
  if (jobsPercentage < 100) {
    deviations.push({ indicador: "Empleo", porcentaje: jobsPercentage, gravedad: statusFor(jobsPercentage) });
  }

  return {
    porcentajes: { inversion: investmentPercentage, empleos: jobsPercentage },
    porcentajeGeneral: minimumPercentage,
    estado: status,
    desviaciones: deviations,
  };
}

function statusFor(percentage) {
  if (percentage < 80) return ALERT_LEVELS.CRITICAL;
  if (percentage < 100) return ALERT_LEVELS.PREVENTIVE;
  return ALERT_LEVELS.OK;
}

