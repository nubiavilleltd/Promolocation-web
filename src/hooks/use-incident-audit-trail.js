import { useQuery } from "@tanstack/react-query";
import { getIncidentAuditTrail } from "../api/incidents";

export function getIncidentAuditTrailQueryKey(incidentId) {
  return ["incident-audit-trail", incidentId];
}

export function useIncidentAuditTrail(incident) {
  const incidentId = incident?.id ? String(incident.id) : "";

  return useQuery({
    queryKey: getIncidentAuditTrailQueryKey(incidentId),
    queryFn: () => getIncidentAuditTrail({ incidentId }),
    enabled: Boolean(incidentId),
    initialData: [],
  });
}
