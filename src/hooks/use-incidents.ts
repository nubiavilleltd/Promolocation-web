import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.user?.user_id);
  const normalizedUserId = userId ? String(userId) : "";

  return useMutation<UpdateIncidentResponse, Error, UpdateIncidentPayload>({
    mutationFn: updateIncident,
    onSuccess: (_, variables) => {
      const invalidations = [
        queryClient.invalidateQueries({
          queryKey: getIncidentsQueryKey(normalizedUserId),
        }),
      ];

      if (variables.incidentId) {
        invalidations.push(
          queryClient.invalidateQueries({
            queryKey: getIncidentAuditTrailQueryKey(variables.incidentId),
          }),
        );
      }

      return Promise.all(invalidations);
    },
  });
}
