import {
  Incident,
  IncidentAuditEntry,
  RawIncident,
  RawIncidentAuditEntry,
} from "./incidents";
import { mapPromoterBrand } from "./promoter-brands";
import { Promoter, PromoterStatus, RawPromoter } from "./promoters";
import { getAgencyId, getAgencyName } from "../src/utils/agency";

function normalizeDateTimeValue(value: string | number | null | undefined) {
  const text = value == null ? "" : String(value).trim();

  if (!text) {
    return {
      dateTime: "",
      time: 0,
    };
  }

  if (/^\d+$/.test(text)) {
    const numericValue = Number(text);
    const time = text.length <= 10 ? numericValue * 1000 : numericValue;

    return {
      dateTime: Number.isFinite(time) ? new Date(time).toISOString() : "",
      time: Number.isFinite(time) ? time : 0,
    };
  }

  const dateTime = text.replace(" ", "T");
  const time = Date.parse(dateTime);

  return {
    dateTime,
    time: Number.isNaN(time) ? 0 : time,
  };
}

function getNewestDateTimeValue(
  values: Array<string | number | null | undefined>,
) {
  return values
    .map(normalizeDateTimeValue)
    .reduce(
      (newest, current) => (current.time > newest.time ? current : newest),
      { dateTime: "", time: 0 },
    );
}

export function mapPromoter(user: RawPromoter): Promoter {
  const status: PromoterStatus = user.active === "1" ? "Active" : "Inactive";
  const createdOn = normalizeDateTimeValue(user.created_on);
  const rawBrands = Array.isArray(user.brands) ? user.brands : [];
  const brands = rawBrands.map(mapPromoterBrand);
  const lastUpdated = getNewestDateTimeValue([
    user.updated_at,
    ...rawBrands.flatMap((brand) => [brand.updated_at, brand.last_updated]),
  ]);

  return {
    id: user.id,
    promoterId: user.promoter_id,
    promoterCode: user.promo_code || "",
    firstName: user.first_name,
    lastName: user.last_name,
    fullName: user.fullname.replace(/\s+/g, " ").trim(),
    email: user.email,
    phone: user.phone,
    role: user.user_role,
    active: status === "Active",
    status,
    agencyId: getAgencyId(user),
    agencyName: getAgencyName(user),
    agency: getAgencyName(user),
    createdOn: createdOn.dateTime,
    createdOnTime: createdOn.time,
    lastUpdated: lastUpdated.dateTime,
    lastUpdatedTime: lastUpdated.time,
    address: user.address,
    designation: user.designation,
    region: user.region.replace(/\s+/g, " ").trim(),
    area: user.area,
    avatar: user.avatar,
    image: user.image,
    emergencyContact: user.emergency_contact,
    profileStatus: user.profile_status === "Yes",
    brands,
  };
}

function normalizeIncidentDate(dateTime: string) {
  return dateTime.replace(" ", "T");
}

function normalizeIncidentStatus(status: string): Incident["status"] {
  const normalizedStatus = status.trim().toLowerCase().replace(/[_-]+/g, " ");

  switch (normalizedStatus) {
    case "pending":
      return "Pending";
    case "in progress":
      return "In Progress";
    case "on hold":
      return "On Hold";
    case "resolved":
      return "Resolved";
    case "not resolved":
    case "deny":
    case "denied":
      return "Not Resolved";
    case "closed":
      return "Closed";
    default:
      return status as Incident["status"];
  }
}

export function mapIncident(incident: RawIncident): Incident {
  return {
    id: String(incident.incident_id),
    title: incident.title || null,
    promoterId: incident.promoter_id,
    userId: String(incident.user_id),
    issue: incident.incident_name,
    category: incident.issue_category,
    requestType: incident.request_type || "Incident Report",
    priority: incident.priority || "Medium",
    description: incident.description,
    status: normalizeIncidentStatus(incident.status),
    date: normalizeIncidentDate(incident.created_at),
    updatedAt: incident.updated_at
      ? normalizeIncidentDate(incident.updated_at)
      : null,
    image: incident.photo,
    attachments: Array.isArray(incident.attachments)
      ? incident.attachments.filter(
          (attachment): attachment is string =>
            typeof attachment === "string" && attachment.trim().length > 0,
        )
      : incident.photo
        ? [incident.photo]
        : [],
    adminNote: incident.admin_note,
    issueLocation: incident.issue_location || null,
    browserLink: incident.browser_link || null,
    agency: incident.agency || null,
    relatedAgency: incident.related_agency || null,
    reporterName: incident.reporter_name || null,
    reporterEmail: incident.reporter_email || null,
    reporterPhone: incident.reporter_phone || null,
  };
}

export function mapIncidentAuditEntry(
  entry: RawIncidentAuditEntry,
): IncidentAuditEntry {
  return {
    id: String(entry.audit_id),
    incidentId: String(entry.incident_id),
    title: entry.title || null,
    userName: entry.user_name || null,
    userId: String(entry.user_id),
    incidentTitle: entry.incident_title,
    action: entry.action,
    comment: entry.comment,
    dateTime: normalizeIncidentDate(entry.date_time),
  };
}
