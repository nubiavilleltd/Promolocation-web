import { mapIncident, mapIncidentAuditEntry } from "../../types/mapper";
import {
  CreateIncidentPayload,
  CreateIncidentResponse,
  GetIncidentAuditTrailPayload,
  GetIncidentAuditTrailResponse,
  GetIncidentsPayload,
  GetIncidentsResponse,
  Incident,
  IncidentAuditEntry,
  UpdateIncidentPayload,
  UpdateIncidentResponse,
} from "../../types/incidents";
import { apiClient } from "./client";
import { authenticatedAdminPost } from "./loggedIn-client";

const API_TOKEN = import.meta.env.VITE_API_TOKEN ?? "";
const GET_INCIDENTS_PATH = "/get_incidents";
const UPDATE_INCIDENT_PATH = "/admin_api/update_incident";
const GET_INCIDENT_AUDIT_TRAIL_PATH = "/admin_api/get_incident_audit_trail";
const CREATE_INCIDENT_PATH = "/create_incident";

function normalizeIncidentIdentifier(incidentId: string) {
  return /^\d+$/.test(incidentId) ? Number(incidentId) : incidentId;
}

export async function getIncidents(
  payload: GetIncidentsPayload,
): Promise<Incident[]> {
  const { userId, ...filters } = payload;

  if (!userId) {
    throw new Error("No user ID found. Please log in again.");
  }

  const response = await apiClient<GetIncidentsResponse>(GET_INCIDENTS_PATH, {
    method: "POST",
    body: JSON.stringify({
      token: API_TOKEN,
      user_id: userId,
      ...filters,
    }),
  });

  if (response.status !== 200) {
    throw new Error("Failed to fetch incidents.");
  }

  return response.incidents.map(mapIncident);
}

export async function updateIncident(
  payload: UpdateIncidentPayload,
): Promise<UpdateIncidentResponse> {
  const requestBody: Record<string, unknown> = {
    status: payload.status,
  };

  if (payload.incidentId) {
    requestBody.incident_id = normalizeIncidentIdentifier(payload.incidentId);
  } else if (payload.title) {
    requestBody.title = payload.title;
  }

  if (payload.comment) {
    requestBody.comment = payload.comment;
  }

  const response = await authenticatedAdminPost<UpdateIncidentResponse>(
    UPDATE_INCIDENT_PATH,
    requestBody,
  );

  if (response.status !== 200) {
    throw new Error(response.message || "Failed to update incident.");
  }

  return response;
}

export async function getIncidentAuditTrail(
  payload: GetIncidentAuditTrailPayload,
): Promise<IncidentAuditEntry[]> {
  const requestBody: Record<string, unknown> = {};

  if (payload.incidentId) {
    requestBody.incident_id = normalizeIncidentIdentifier(payload.incidentId);
  } else if (payload.title) {
    requestBody.title = payload.title;
  } else {
    throw new Error("Incident ID or title is required.");
  }

  const response = await authenticatedAdminPost<GetIncidentAuditTrailResponse>(
    GET_INCIDENT_AUDIT_TRAIL_PATH,
    requestBody,
  );

  if (response.status !== 200) {
    throw new Error(
      response.message || "Failed to fetch incident audit trail.",
    );
  }

  console.log("[getIncidentAuditTrail] response", response);

  return response.audit_trail
    .map(mapIncidentAuditEntry)
    .sort((leftEntry, rightEntry) => {
      const leftTime = Date.parse(leftEntry.dateTime);
      const rightTime = Date.parse(rightEntry.dateTime);

      return (
        (Number.isNaN(leftTime) ? 0 : leftTime) -
        (Number.isNaN(rightTime) ? 0 : rightTime)
      );
    });
}

export async function createIncident(
  payload: CreateIncidentPayload,
): Promise<CreateIncidentResponse> {
  const formData = new FormData();
  formData.append("token", API_TOKEN);
  formData.append("promoter_id", payload.promoterId);
  formData.append("title", payload.title);

  if (payload.userId) {
    formData.append("user_id", payload.userId);
  }
  if (payload.details) {
    formData.append("details", payload.details);
  }
  if (payload.requestType) {
    formData.append("request_type", payload.requestType);
  }
  if (payload.priority) {
    formData.append("priority", payload.priority);
  }
  if (payload.relatedAgency) {
    formData.append("related_agency", payload.relatedAgency);
  }
  if (payload.issueLocation) {
    formData.append("issue_location", payload.issueLocation);
  }
  if (payload.browserLink) {
    formData.append("browser_link", payload.browserLink);
  }
  payload.attachments?.forEach((attachment) => {
    formData.append("attachment[]", attachment);
  });

  const response = await apiClient<CreateIncidentResponse>(
    CREATE_INCIDENT_PATH,
    {
      method: "POST",
      body: formData,
    },
  );

  if (response.status !== 200) {
    throw new Error(response.message || "Failed to create incident.");
  }

  return response;
}
