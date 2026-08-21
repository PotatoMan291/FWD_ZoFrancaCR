import { AI_CLASSIFICATIONS, APPLICATION_STATES } from "../config.js";
import { getApplications } from "./applicationsService.js";
import { getComplianceData, summarizeCompliance } from "./complianceService.js";
import { getZones } from "./zonesService.js";

export async function getDashboardData() {
  const [applications, compliance, zones] = await Promise.all([
    getApplications(),
    getComplianceData(),
    getZones(),
  ]);

  const decided = applications.filter((application) => application.fechaDecision);
  const averageResponseHours = decided.length
    ? decided.reduce((sum, application) => {
        const created = new Date(application.fechaCreacion);
        const decidedAt = new Date(application.fechaDecision);
        return sum + Math.max(0, decidedAt - created) / 3_600_000;
      }, 0) / decided.length
    : null;

  return {
    applications,
    compliance,
    zones,
    applicationMetrics: {
      total: applications.length,
      recommended: applications.filter(
        (application) => application.clasificacionIA === AI_CLASSIFICATIONS.RECOMMENDED,
      ).length,
      review: applications.filter(
        (application) => application.clasificacionIA === AI_CLASSIFICATIONS.REVIEW,
      ).length,
      rejected: applications.filter(
        (application) =>
          application.clasificacionIA === AI_CLASSIFICATIONS.REJECTED ||
          application.estado === APPLICATION_STATES.REJECTED,
      ).length,
      pending: applications.filter((application) => application.estado === APPLICATION_STATES.PENDING).length,
      approvedPercentage: applications.length
        ? (applications.filter((application) => application.estado === APPLICATION_STATES.APPROVED).length /
            applications.length) *
          100
        : 0,
      averageResponseHours,
    },
    complianceMetrics: summarizeCompliance(compliance),
  };
}

