import React from "react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Swal from "sweetalert2";
import AppLayout from "../components/AppLayout";
import DataTable from "../components/DataTable";
import { getHelpDeskRequestById } from "../data/helpDeskMock";
import { useAutoResizeTextarea } from "../hooks/use-auto-resize-textarea";
import { useAuthStore } from "../store/auth-store";
import { isSpecialAdminUser } from "../utils/authAccess";
import { assetPath } from "../utils/assetPath";
import { formatLongDate, getIncidentStatusColor } from "../utils/formatters";
import { REGULAR_ADMIN_TEAM_LABEL, SPECIAL_ADMIN_TEAM_LABEL } from "../utils/uiLabels";

const ADMIN_REQUEST_ACTIONS = {
  Submitted: ["In Progress", "On Hold", "Resolved"],
  "In Progress": ["In Progress", "On Hold", "Resolved"],
  "On Hold": ["In Progress", "On Hold", "Resolved"],
  "Not Resolved": ["In Progress", "On Hold", "Resolved"],
};

const SPECIAL_ADMIN_REQUEST_ACTIONS = {
  Resolved: ["Not Resolved", "Closed"],
};

function getAvailableRequestStatusOptions(currentStatus, isSpecialAdmin) {
  if (!currentStatus) {
    return [];
  }

  const statusOptions = isSpecialAdmin
    ? SPECIAL_ADMIN_REQUEST_ACTIONS
    : ADMIN_REQUEST_ACTIONS;

  return statusOptions[currentStatus] || [];
}

function getRequestActionHelperCopy(currentStatus, isSpecialAdmin) {
  if (isSpecialAdmin) {
    switch (currentStatus) {
      case "Submitted":
        return `This request is waiting for ${REGULAR_ADMIN_TEAM_LABEL} review. You can act after ${REGULAR_ADMIN_TEAM_LABEL} resolves it.`;
      case "In Progress":
        return `${REGULAR_ADMIN_TEAM_LABEL} is currently working on this request. You cannot update it right now.`;
      case "On Hold":
        return `${REGULAR_ADMIN_TEAM_LABEL} has placed this request on hold. You cannot update it right now.`;
      case "Resolved":
        return `Review the ${REGULAR_ADMIN_TEAM_LABEL} resolution and either confirm it as closed or return it as not resolved.`;
      case "Not Resolved":
        return `${REGULAR_ADMIN_TEAM_LABEL} must resolve this request again before you can take another action.`;
      case "Closed":
        return "This request has been closed and no further action is available.";
      default:
        return "Review the current request status before taking action.";
    }
  }

  switch (currentStatus) {
    case "Submitted":
      return "This request has just been submitted. Move it into progress, place it on hold, or resolve it.";
    case "In Progress":
      return "Continue working the request, place it on hold, keep it in progress, or mark it resolved when the work has been handled.";
    case "On Hold":
      return "This request is currently on hold. Move it back into progress, keep it on hold, or resolve it when work resumes.";
    case "Resolved":
      return `${SPECIAL_ADMIN_TEAM_LABEL} must now review this resolution before the request can be closed.`;
    case "Not Resolved":
      return "The resolution was rejected. Move the request back to In Progress, place it on hold, or resolve it again.";
    case "Closed":
      return "This request has been closed and can no longer be updated.";
    default:
      return "Select the next status for this request.";
  }
}

function formatStatusOptionsList(statusOptions) {
  if (!statusOptions.length) {
    return "";
  }

  if (statusOptions.length === 1) {
    return statusOptions[0];
  }

  if (statusOptions.length === 2) {
    return `${statusOptions[0]} or ${statusOptions[1]}`;
  }

  return `${statusOptions.slice(0, -1).join(", ")}, or ${statusOptions[statusOptions.length - 1]}`;
}

function BackArrow() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M19 12H5" />
      <path d="M12 19l-7-7 7-7" />
    </svg>
  );
}

export default function IncidentDetailPage() {
  const [selectedStatus, setSelectedStatus] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const adminCommentTextareaRef = useRef(null);
  const { incidentId } = useParams();
  const [request, setRequest] = useState(() => getHelpDeskRequestById(incidentId));
  const [auditTrail, setAuditTrail] = useState(() => request?.auditTrail || []);
  const [isUpdatingRequest, setIsUpdatingRequest] = useState(false);
  const authUser = useAuthStore((state) => state.user);
  const authUserId = authUser?.user_id;
  const navigate = useNavigate();
  const statusColor = getIncidentStatusColor(request?.status);
  const isSpecialAdmin = isSpecialAdminUser(authUser);
  const availableStatusOptions = getAvailableRequestStatusOptions(
    request?.status,
    isSpecialAdmin,
  );
  const canUpdateRequest = availableStatusOptions.length > 0;
  const isCommentRequired = selectedStatus === "Not Resolved";
  const requestActionHelperCopy = getRequestActionHelperCopy(
    request?.status,
    isSpecialAdmin,
  );
  const requestActionTitle = isSpecialAdmin ? "Requester Review" : "Request Action";

  useAutoResizeTextarea(adminCommentTextareaRef, adminNote);

  useEffect(() => {
    if (!request) {
      setSelectedStatus("");
      setAdminNote("");
      return;
    }

    setSelectedStatus("");
    setAdminNote(canUpdateRequest ? "" : request.adminNote || "");
  }, [request, canUpdateRequest]);

  if (!request) {
    return (
      <AppLayout activeNav="incidents" mainContentClassName="detail-main">
        <div className="detail-wrapper">
          <button type="button" className="back-btn" onClick={() => navigate("/incidents")}>
            <BackArrow />
            Back to Help Desk
          </button>
          <div className="incident-card">
            <h1 className="page-title">Request Details</h1>
            <p className="detail-empty-copy">
              We couldn't find that request anymore. It may have been removed or the
              link is no longer valid.
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  const attachmentSource = request.image ? assetPath(request.image) : null;
  const trimmedAdminNote = adminNote.trim();

  const handleStatusUpdate = async (event) => {
    event.preventDefault();

    if (!canUpdateRequest) {
      await Swal.fire({
        icon: "info",
        title: "No Action Available",
        text: requestActionHelperCopy,
        confirmButtonColor: "#0E2B63",
      });
      return;
    }

    if (!selectedStatus) {
      Swal.fire({
        icon: "error",
        title: "Select a Status",
        text: `Choose ${formatStatusOptionsList(availableStatusOptions)} before saving.`,
        confirmButtonColor: "#d33",
      });
      return;
    }

    if (isSpecialAdmin && selectedStatus === "Not Resolved" && !trimmedAdminNote) {
      Swal.fire({
        icon: "error",
        title: "Comment Required",
        text: "Add a comment before marking this request as not resolved.",
        confirmButtonColor: "#d33",
      });
      return;
    }

    try {
      setIsUpdatingRequest(true);
      const actionLabel =
        selectedStatus === "Closed"
          ? "Closed request"
          : selectedStatus === "Not Resolved"
            ? "Marked request Not Resolved"
            : `Marked request ${selectedStatus}`;

      setRequest((currentRequest) => ({
        ...currentRequest,
        status: selectedStatus,
        adminNote: trimmedAdminNote || currentRequest.adminNote,
        resolutionSummary:
          selectedStatus === "Resolved"
            ? trimmedAdminNote || currentRequest.resolutionSummary
            : currentRequest.resolutionSummary,
      }));
      setAuditTrail((currentTrail) => [
        {
          id: `AUD-${Date.now()}`,
          userId: authUserId ? String(authUserId) : "mock-user",
          action: actionLabel,
          comment: trimmedAdminNote || null,
          dateTime: new Date().toISOString(),
        },
        ...currentTrail,
      ]);

      await Swal.fire({
        title: "Request Updated",
        text: "This prototype updated the request locally so you can review the flow.",
        icon: "success",
        confirmButtonColor: "#0E2B63",
      });

    } catch (updateError) {
      await Swal.fire({
        title: "Unable to Update Request",
        text: updateError?.message || "Something went wrong.",
        icon: "error",
        confirmButtonColor: "#d33",
      });
    } finally {
      setIsUpdatingRequest(false);
    }
  };

  return (
    <AppLayout activeNav="incidents" mainContentClassName="detail-main">
      <div className="detail-wrapper">
        <button type="button" className="back-btn" onClick={() => navigate("/incidents")}>
          <BackArrow />
          Back to Requests
        </button>

        <div className="detail-heading-row">
          <div>
            <span className="detail-overline">REQUEST TITLE</span>
            <h1 className="page-title">{request.issue}</h1>
            <p className="detail-heading-meta">
              <span>{request.id}</span>
            </p>
          </div>
          <span
            className="status-pill detail-status-pill"
            style={{
              color: statusColor,
              backgroundColor: `${statusColor}14`,
            }}
          >
            <span className="detail-status-dot" style={{ backgroundColor: statusColor }} />
            {request.status || "Unknown"}
          </span>
        </div>

        <div className="incident-card">
          <section className="detail-section detail-summary-section">
            <div className="detail-section-heading">
              <div>
                <span className="detail-section-kicker">SUBMITTED</span>
                <h2>Submitted information</h2>
              </div>
            </div>
            <div className="detail-meta-grid detail-submitted-meta-grid">
              <div className="detail-meta-item">
                <span>Request type</span>
                <strong>{request.requestTypeLabel || "—"}</strong>
              </div>
              <div className="detail-meta-item">
                <span>Requester</span>
                <strong>{request.requesterName || "—"}</strong>
              </div>
              <div className="detail-meta-item">
                <span>Priority</span>
                <strong>{request.priority || "—"}</strong>
              </div>
            </div>
          </section>

          <section className="detail-section">
            <div className="detail-section-heading">
              <div>
                <span className="detail-section-kicker">REQUEST</span>
                <h2>Request details</h2>
              </div>
            </div>
            <div className="detail-content-grid detail-submitted-content-grid">
              <div className="detail-content-block detail-content-block-wide">
                <h3>Description</h3>
                <div className="description-box">
                  <p>{request.description || "—"}</p>
                </div>
              </div>
              <div className="detail-content-block">
                <h3>Attachment</h3>
                <div className={`detail-attachment-box${attachmentSource ? " has-attachment" : ""}`}>
                  {attachmentSource ? (
                    <img
                      src={attachmentSource}
                      alt={`Attachment for ${request.issue}`}
                    />
                  ) : (
                    <p>No attachment provided.</p>
                  )}
                </div>
              </div>
            </div>
          </section>

          {request.resolutionSummary ? (
            <section className="detail-section">
              <div className="detail-section-heading">
                <div>
                  <span className="detail-section-kicker">OUTCOME</span>
                  <h2>Resolution summary</h2>
                </div>
              </div>
              <div className="resolution-box">
                <span className="resolution-check" aria-hidden="true">✓</span>
                <div className="description-box">
                  <p>{request.resolutionSummary}</p>
                </div>
              </div>
            </section>
          ) : null}

          <section className="detail-section detail-action-section">
            <div className="detail-section-heading">
              <div>
                <span className="detail-section-kicker">WORKFLOW</span>
                <h2>{requestActionTitle}</h2>
              </div>
            </div>
            <p className="detail-helper-copy">{requestActionHelperCopy}</p>
            <form className="incident-action-form" onSubmit={handleStatusUpdate} noValidate>
              <div className="incident-action-grid">
                <div className="incident-input-group">
                  <label htmlFor="incidentStatus">
                    Update Status
                    {canUpdateRequest ? <span className="required-mark">*</span> : null}
                  </label>
                  <select
                    id="incidentStatus"
                    value={selectedStatus}
                    disabled={isUpdatingRequest || !canUpdateRequest}
                    onChange={(event) => setSelectedStatus(event.target.value)}
                  >
                    <option value="" disabled>
                      {canUpdateRequest ? "Select status" : "No actions available"}
                    </option>
                    {availableStatusOptions.map((statusOption) => (
                      <option key={statusOption} value={statusOption}>
                        {statusOption}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="incident-input-group incident-comment-group">
                  <label htmlFor="adminComment">
                    Comment
                    {isCommentRequired ? <span className="required-mark">*</span> : null}
                  </label>
                  <textarea
                    id="adminComment"
                    ref={adminCommentTextareaRef}
                    rows="5"
                    placeholder={
                      canUpdateRequest
                        ? "Add a comment..."
                        : "No update is available for the current request state."
                    }
                    value={adminNote}
                    disabled={isUpdatingRequest || !canUpdateRequest}
                    onChange={(event) => setAdminNote(event.target.value)}
                  />
                </div>
              </div>

              <div className="resolve-footer">
                <button
                  type="submit"
                  className="resolve-btn"
                  disabled={isUpdatingRequest || !canUpdateRequest || !selectedStatus}
                >
                  {isUpdatingRequest
                    ? "Saving..."
                    : canUpdateRequest
                      ? "Save Update"
                      : "No Action Available"}
                </button>
              </div>
            </form>
          </section>

          <section className="detail-section detail-audit-section">
            <div className="detail-section-heading">
              <div>
                <span className="detail-section-kicker">HISTORY</span>
                <h2>Audit trail</h2>
              </div>
            </div>
            <p className="audit-trail-copy">
              Every request action is recorded here so the full review history stays visible.
            </p>

            <DataTable
              columns={[
                {
                  header: "User ID",
                  key: "userId",
                  render: (auditEntry) => auditEntry.userId,
                },
                {
                  header: "Action",
                  key: "action",
                  render: (auditEntry) => auditEntry.action,
                },
                {
                  header: "Comment",
                  key: "comment",
                  render: (auditEntry) => auditEntry.comment || "--",
                },
                {
                  header: "Date & Time",
                  key: "dateTime",
                  render: (auditEntry) => formatLongDate(auditEntry.dateTime),
                },
              ]}
              dependencies={[request?.id, auditTrail.length]}
              emptyMessage="No audit entries have been recorded for this request yet."
              footerClassName="card-footer audit-trail-footer"
              getRowKey={(auditEntry) => auditEntry.id}
              items={auditTrail}
              tableClassName="audit-trail-table"
              wrapperClassName="audit-trail-table-wrapper"
            />
          </section>
        </div>
      </div>
    </AppLayout>
  );
}
