export type RawIncident = {
  incident_id: string | number;
  title: string | null;
  incident_name: string;
  issue_category: string;
  request_type: string;
  priority: string;
  description: string;
  status: string;
  admin_note: string | null;
  created_at: string;
  updated_at: string | null;
  photo: string | null;
  attachments?: string[] | null;
  promoter_id: string;
  user_id: string | number;
  reporter_name: string | null;
  reporter_email: string | null;
  reporter_phone: string | null;
  issue_location: string | null;
  browser_link: string | null;
  agency: string | null;
  related_agency: string | null;
};

export type RawIncidentAuditEntry = {
  audit_id: string | number;
  incident_id: string | number;
  title: string | null;
  user_name?: string | null;
  user_id: string | number;
  incident_title: string;
  action: string;
  comment: string | null;
  date_time: string;
};

export type IncidentSummary = {
  pending: number;
  in_progress: number;
  resolved: number;
};

export type GetIncidentsResponse = {
  status: number;
  message: string;
  total: number;
  summary: IncidentSummary | null;
  incidents: RawIncident[];
};

export type IncidentStatus =
  | "Pending"
  | "In Progress"
  | "On Hold"
  | "Resolved"
  | "Not Resolved"
  | "Closed";

export type EditableIncidentStatus =
  | "In Progress"
  | "On Hold"
  | "Resolved"
  | "Not Resolved"
  | "Closed";

export type Incident = {
  id: string;
  title: string | null;
  promoterId: string;
  userId: string;
  issue: string;
  category: string;
  requestType: string;
  priority: string;
  description: string;
  status: IncidentStatus;
  date: string;
  updatedAt: string | null;
  image: string | null;
  attachments: string[];
  adminNote: string | null;
  issueLocation: string | null;
  browserLink: string | null;
  agency: string | null;
  relatedAgency: string | null;
  reporterName: string | null;
  reporterEmail: string | null;
  reporterPhone: string | null;
};

export type IncidentAuditEntry = {
  id: string;
  incidentId: string;
  title: string | null;
  userName: string | null;
  userId: string;
  incidentTitle: string;
  action: string;
  comment: string | null;
  dateTime: string;
};

export type CreateIncidentPayload = {
  userId?: string;
  promoterId: string;
  title: string;
  details?: string;
  requestType?: string;
  priority?: string;
  relatedAgency?: string;
  issueLocation?: string;
  browserLink?: string;
  attachments?: File[];
};

export type CreateIncidentResponse = {
  status: number;
  message: string;
  incident?: RawIncident;
  power_automate?: {
    sent: boolean;
  };
};

export type GetIncidentsPayload = {
  userId: string;
  incidentId?: string;
  title?: string;
  status?: string;
  issueCategory?: string;
};

export type UpdateIncidentPayload = {
  incidentId?: string;
  title?: string;
  status: EditableIncidentStatus;
  comment?: string;
};

export type UpdateIncidentResponse = {
  status: number;
  message: string;
  incident_id?: string | number;
  title?: string | null;
  new_status?: IncidentStatus;
  power_automate?: {
    sent: boolean;
    skipped: string | null;
  };
  updated_at?: string;
};

export type GetIncidentAuditTrailPayload = {
  incidentId?: string;
  title?: string;
};

export type GetIncidentAuditTrailResponse = {
  status: number;
  message: string;
  audit_trail: RawIncidentAuditEntry[];
};

export type UpdateIncidentStatusPayload = {
  incident_id: string;
  status: EditableIncidentStatus;
  comment?: string;
};

export type UpdateIncidentStatusResponse = {
  status: number;
  message: string;
  incident?: {
    incident_id?: string | number;
    status?: IncidentStatus;
    comment?: string | null;
    admin_note?: string | null;
  };
};
