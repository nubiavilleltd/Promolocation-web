import {
  QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  CreateIncidentPayload,
  CreateIncidentResponse,
  Incident,
  UpdateIncidentPayload,
  UpdateIncidentResponse,
} from "../../types/incidents";
import { createIncident, getIncidents, updateIncident } from "../api/incidents";
import { getIncidentAuditTrailQueryKey } from "./use-incident-audit-trail";
import { useAuthStore } from "../store/auth-store";

export function getIncidentsQueryKey(userId: string) {
  return ["incidents", userId];
}

/**
 * Refresh the incident list (and optionally a single incident's audit trail).
 * Kept separate from the mutation so callers can run it in the background,
 * e.g. after the success prompt is dismissed, without delaying the result.
 */
export function invalidateIncidentQueries(
  queryClient: QueryClient,
  userId: string,
  incidentId?: string,
) {
  const invalidations = [
    queryClient.invalidateQueries({ queryKey: getIncidentsQueryKey(userId) }),
  ];

  if (incidentId) {
    invalidations.push(
      queryClient.invalidateQueries({
        queryKey: getIncidentAuditTrailQueryKey(incidentId),
      }),
    );
  }

  return Promise.all(invalidations);
}

export function useIncidents() {
  const userId = useAuthStore((state) => state.user?.user_id);
  const normalizedUserId = userId ? String(userId) : "";

  return useQuery<Incident[], Error>({
    queryKey: getIncidentsQueryKey(normalizedUserId),
    queryFn: () => getIncidents({ userId: normalizedUserId }),
    enabled: Boolean(normalizedUserId),
  });
}

export function useCreateIncident() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.user?.user_id);
  const normalizedUserId = userId ? String(userId) : "";

  return useMutation<CreateIncidentResponse, Error, CreateIncidentPayload>({
    mutationFn: createIncident,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: getIncidentsQueryKey(normalizedUserId),
      });
    },
  });
}

export function useUpdateIncident() {
  return useMutation<UpdateIncidentResponse, Error, UpdateIncidentPayload>({
    mutationFn: updateIncident,
  });
}
