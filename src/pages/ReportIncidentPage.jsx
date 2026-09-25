import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import AppLayout from "../components/AppLayout";
import { HELP_DESK_REQUEST_TYPES } from "../data/helpDeskMock";
import { useAutoResizeTextarea } from "../hooks/use-auto-resize-textarea";
import {
  validateFileSize,
  validateImageUpload,
} from "../utils/imageUploadValidation";

const PRIORITY_OPTIONS = ["Low", "Medium", "High"];
const DOCUMENT_ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt";
const DOCUMENT_EXTENSIONS = ["pdf", "doc", "docx", "xls", "xlsx", "csv", "txt"];
const DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "text/plain",
];

function validateDocumentUpload(file) {
  if (!file) {
    return null;
  }

  const normalizedMimeType =
    typeof file.type === "string" ? file.type.toLowerCase() : "";
  const normalizedFileName =
    typeof file.name === "string" ? file.name.toLowerCase() : "";
  const hasAllowedExtension = DOCUMENT_EXTENSIONS.some((extension) =>
    normalizedFileName.endsWith(`.${extension}`),
  );
  const hasAllowedMimeType = DOCUMENT_MIME_TYPES.includes(normalizedMimeType);

  if (!hasAllowedExtension && !hasAllowedMimeType) {
    return "Only PDF, Word, Excel, CSV, or text documents are allowed for this request.";
  }

  return validateFileSize(file, "Document");
}

function getMissingRequestFields({ requestType, title, description }) {
  const missingFields = [];

  if (!requestType) {
    missingFields.push("Request Type");
  }

  if (!title) {
    missingFields.push("Request Title");
  }

  if (!description) {
    missingFields.push("Request Details");
  }

  return missingFields;
}

function BackArrow() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <path d="M19 12H5" />
      <path d="M12 19l-7-7 7-7" />
    </svg>
  );
}

export default function ReportIncidentPage() {
  const [requestType, setRequestType] = useState("incident_report");
  const [title, setTitle] = useState("");
  const [browserLink, setBrowserLink] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef(null);
  const descriptionTextareaRef = useRef(null);
  const navigate = useNavigate();
  const selectedRequestType = HELP_DESK_REQUEST_TYPES.find(
    (type) => type.value === requestType,
  );
  const isIncidentReport = requestType === "incident_report";
  const attachmentAccept = isIncidentReport ? "image/*" : DOCUMENT_ACCEPT;
  const attachmentPrompt = isIncidentReport
    ? "Tap to upload incident image"
    : "Tap to upload supporting document";
  const attachmentSubtext = isIncidentReport
    ? "JPG, PNG or WEBP (Max 3MB)"
    : "PDF, DOCX, XLSX, CSV or TXT (Max 3MB)";

  useAutoResizeTextarea(descriptionTextareaRef, description);

  const resetSelectedImage = () => {
    setImage(null);
    setPreview(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRequestTypeChange = (nextRequestType) => {
    if (nextRequestType !== requestType) {
      resetSelectedImage();
    }

    setRequestType(nextRequestType);
  };

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const validationError = isIncidentReport
      ? validateImageUpload(file)
      : validateDocumentUpload(file);

    if (validationError) {
      resetSelectedImage();
      Swal.fire({
        icon: "error",
        title: isIncidentReport ? "Invalid Image" : "Invalid Document",
        text: validationError,
        confirmButtonColor: "#d33",
      });
      return;
    }

    setImage(file);

    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();
    const missingFieldLabels = getMissingRequestFields({
      requestType,
      title: trimmedTitle,
      description: trimmedDescription,
    });

    if (missingFieldLabels.length) {
      Swal.fire({
        icon: "warning",
        title: "Missing Request Details",
        text: `Please complete: ${missingFieldLabels.join(", ")}.`,
        confirmButtonColor: "#3085d6",
      });
      return;
    }

    if (image) {
      const attachmentValidationError = isIncidentReport
        ? validateImageUpload(image)
        : validateDocumentUpload(image);

      if (attachmentValidationError) {
        resetSelectedImage();
        Swal.fire({
          icon: "error",
          title: isIncidentReport ? "Invalid Image" : "Invalid Document",
          text: attachmentValidationError,
          confirmButtonColor: "#d33",
        });
        return;
      }
    }

    setIsSubmitting(true);

    try {
      await new Promise((resolve) => {
        window.setTimeout(resolve, 500);
      });

      await Swal.fire({
        icon: "success",
        title: "Request Submitted",
        text: "This prototype submitted the request locally so you can review the Help Desk flow.",
        confirmButtonColor: "#22c55e",
        confirmButtonText: "OK",
      });

      navigate("/incidents");
    } catch (error) {
      console.error("Failed to submit request:", error);
      Swal.fire({
        icon: "error",
        title: "Submission Failed",
        text:
          error?.message ||
          "Something went wrong while submitting the request.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppLayout activeNav="report_incident" mainContentClassName="detail-main">
      <div className="report-page-wrapper">
        <button
          type="button"
          className="back-btn report-back-btn"
          onClick={() => navigate("/incidents")}
        >
          <BackArrow />
          Back to Requests
        </button>

        <div className="report-header">
          <h1>New Help Desk Request</h1>
          <p>
            Submit incidents, change requests, access requests, and operational
            support needs.
          </p>
        </div>

        <div className="report-card-container">
          <form
            onSubmit={handleSubmit}
            className="report-form-premium"
            noValidate
          >
            <div className="request-type-guide" aria-labelledby="request-type-guide-label">
              <p className="request-type-guide-label" id="request-type-guide-label">
                Request type guide
              </p>
              <div className="request-type-guide-grid">
                {HELP_DESK_REQUEST_TYPES.map((type) => (
                  <div className="request-type-guide-card" key={type.value}>
                    <h3>{type.label}</h3>
                    <p>{type.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="report-field-grid">
              <div className="input-field-group">
                <label htmlFor="request-location">Issue Location</label>
                <input
                  id="request-location"
                  type="text"
                  placeholder="Where did this happen?"
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  disabled={isSubmitting}
                  className="premium-input-field"
                />
              </div>

              <div className="input-field-group">
                <label htmlFor="request-browser-link">Browser Link</label>
                <input
                  id="request-browser-link"
                  type="url"
                  placeholder="Paste a browser link"
                  value={browserLink}
                  onChange={(event) => setBrowserLink(event.target.value)}
                  disabled={isSubmitting}
                  className="premium-input-field"
                />
              </div>
            </div>

            <div className="input-field-group">
              <label htmlFor="request-title">
                Request Title <span className="required-mark">*</span>
              </label>
              <input
                id="request-title"
                type="text"
                placeholder={
                  selectedRequestType?.value === "change_request"
                    ? "Example: Update promotion dates for Zipline"
                    : selectedRequestType?.value === "access_request"
                      ? "Example: Grant Zipline admin access"
                      : "Use a descriptive title that summarizes the request."
                }
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                disabled={isSubmitting}
                className="premium-input-field"
              />
            </div>

            <div className="request-meta-grid">
              <div className="input-field-group">
                <label htmlFor="request-priority">Priority</label>
                <select
                  id="request-priority"
                  value={priority}
                  onChange={(event) => setPriority(event.target.value)}
                  disabled={isSubmitting}
                  className="premium-input-field"
                >
                  {PRIORITY_OPTIONS.map((priorityOption) => (
                    <option key={priorityOption} value={priorityOption}>
                      {priorityOption}
                    </option>
                  ))}
                </select>
              </div>

              <div className="input-field-group request-type-field">
                <label htmlFor="request-type">
                  Request Type <span className="required-mark">*</span>
                </label>
                <select
                  id="request-type"
                  value={requestType}
                  onChange={(event) =>
                    handleRequestTypeChange(event.target.value)
                  }
                  disabled={isSubmitting}
                  className="premium-input-field"
                >
                  {HELP_DESK_REQUEST_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="input-field-group report-attachment-field">
              <label>Attachment</label>
              <div
                className={`premium-upload-zone ${preview ? "has-image" : ""} ${image && !preview ? "has-file" : ""}`}
                onClick={() =>
                  !isSubmitting && fileInputRef.current.click()
                }
              >
                {preview ? (
                  <>
                    <img
                      src={preview}
                      alt="Request attachment preview"
                      className="evidence-preview-img"
                    />
                    <div className="upload-overlay">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                        <circle cx="12" cy="13" r="4" />
                      </svg>
                      <span>Change Attachment</span>
                    </div>
                  </>
                ) : image ? (
                  <div className="upload-file-state">
                    <div className="upload-icon-circle">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="8" y1="13" x2="16" y2="13" />
                        <line x1="8" y1="17" x2="16" y2="17" />
                      </svg>
                    </div>
                    <p className="upload-prompt">{image.name}</p>
                    <p className="upload-subtext">Tap to replace document</p>
                  </div>
                ) : (
                  <div className="upload-empty-state">
                    <div className="upload-icon-circle">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                    </div>
                    <p className="upload-prompt">{attachmentPrompt}</p>
                    <p className="upload-subtext">{attachmentSubtext}</p>
                  </div>
                )}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageChange}
                  accept={attachmentAccept}
                  style={{ display: "none" }}
                />
              </div>
            </div>

            <div className="input-field-group">
              <label htmlFor="request-desc">
                Request Details <span className="required-mark">*</span>
              </label>
              <textarea
                id="request-desc"
                ref={descriptionTextareaRef}
                placeholder="Include the exact change needed and any deadline or context..."
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                disabled={isSubmitting}
                className="premium-textarea-field"
              />
            </div>

            <div className="report-form-footer">
              <button
                type="submit"
                className="submit-report-btn"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <span className="spinner"></span>
                    Submitting...
                  </>
                ) : (
                  "Submit Request"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      <style jsx>{`
        .report-page-wrapper {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .report-back-btn {
          align-self: flex-start;
        }

        .report-header h1 {
          font-size: 28px;
          font-weight: 800;
          color: var(--navy);
        }

        .report-header p {
          color: var(--text-gray);
          font-size: 16px;
        }

        .report-card-container {
          background: #ffffff;
          border-radius: 20px;
          box-shadow: 0 10px 40px rgba(14, 43, 99, 0.08);
          border: 1px solid var(--border-blue);
          overflow: hidden;
        }

        .report-form-premium {
          padding: 32px;
        }

        .request-type-guide {
          margin-bottom: 24px;
        }

        .request-type-guide-label {
          margin: 0 0 8px;
          color: var(--text-muted, #64748b);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .request-type-guide-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }

        .request-type-guide-card {
          min-width: 0;
          border: 1px solid #e2e8f0;
          border-radius: var(--radius, 12px);
          background: var(--surface-1, #f8fafc);
          padding: 12px 14px;
        }

        .request-type-guide-card h3 {
          margin: 0 0 5px;
          color: var(--text-primary, #334d72);
          font-size: 13.5px;
          font-weight: 600;
          line-height: 1.35;
        }

        .request-type-guide-card p {
          margin: 0;
          color: var(--text-secondary, #718198);
          font-size: 12.5px;
          line-height: 1.5;
        }

        .request-type-panel {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 28px;
        }

        .request-type-option {
          display: flex;
          min-height: 120px;
          flex-direction: column;
          gap: 8px;
          justify-content: flex-start;
          text-align: left;
          border: 1px solid var(--border-blue);
          border-radius: 8px;
          background: #ffffff;
          color: var(--navy);
          padding: 16px;
          cursor: pointer;
          transition:
            border-color 0.2s,
            box-shadow 0.2s,
            transform 0.2s;
        }

        .request-type-option:hover:not(:disabled),
        .request-type-option.is-selected {
          border-color: #2563eb;
          box-shadow: 0 12px 30px rgba(37, 99, 235, 0.12);
          transform: translateY(-1px);
        }

        .request-type-option span {
          font-size: 15px;
          font-weight: 800;
        }

        .request-type-option small {
          color: #64748b;
          font-size: 13px;
          line-height: 1.45;
        }

        .report-field-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
        }

        .request-meta-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
        }

        .request-type-field {
          width: 100%;
        }

        .input-field-group {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 24px;
        }

        .input-field-group label {
          font-weight: 700;
          font-size: 15px;
          color: var(--navy);
        }

        .premium-input-field {
          height: 48px;
          padding: 0 16px;
          background: #f8fafc;
          border: 1.5px solid #e2e8f0;
          border-radius: 12px;
          font-size: 15px;
          transition: all 0.2s;
        }

        .premium-input-field:focus {
          border-color: var(--accent-blue);
          background: #fff;
          box-shadow: 0 0 0 4px rgba(0, 168, 232, 0.1);
          outline: none;
        }

        .premium-textarea-field {
          min-height: 240px;
          padding: 16px;
          background: #f8fafc;
          border: 1.5px solid #e2e8f0;
          border-radius: 12px;
          font-size: 15px;
          line-height: 1.6;
          transition: all 0.2s;
          overflow: hidden;
          resize: none;
        }

        .premium-textarea-field:focus {
          border-color: var(--accent-blue);
          background: #fff;
          box-shadow: 0 0 0 4px rgba(0, 168, 232, 0.1);
          outline: none;
        }

        .premium-upload-zone {
          border: 2px dashed #cbd5e1;
          border-radius: 16px;
          height: 220px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
          overflow: hidden;
          position: relative;
          background: #f8fafc;
        }

        .premium-upload-zone:hover {
          border-color: var(--accent-blue);
          background: #f0f9ff;
        }

        .premium-upload-zone.has-image {
          border-style: solid;
          border-color: #e2e8f0;
        }

        .premium-upload-zone.has-file {
          border-style: solid;
          border-color: #e2e8f0;
        }

        .upload-empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 20px;
        }

        .upload-file-state {
          display: flex;
          max-width: 100%;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 20px;
        }

        .upload-file-state .upload-prompt {
          max-width: 260px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .upload-icon-circle {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: #fff;
          border: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #64748b;
          margin-bottom: 16px;
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
        }

        .upload-icon-circle svg {
          width: 24px;
          height: 24px;
        }

        .upload-prompt {
          font-weight: 700;
          font-size: 15px;
          color: var(--navy);
          margin: 0 0 4px;
        }

        .upload-subtext {
          font-size: 12px;
          color: #94a3b8;
          margin: 0;
        }

        .evidence-preview-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .upload-overlay {
          position: absolute;
          inset: 0;
          background: rgba(14, 43, 99, 0.4);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #fff;
          opacity: 0;
          transition: opacity 0.2s;
          backdrop-filter: blur(4px);
          gap: 10px;
        }

        .premium-upload-zone:hover .upload-overlay {
          opacity: 1;
        }

        .upload-overlay svg {
          width: 32px;
          height: 32px;
        }

        .upload-overlay span {
          font-weight: 600;
          font-size: 14px;
        }

        .report-form-footer {
          display: flex;
          justify-content: flex-end;
          gap: 20px;
          margin-top: 40px;
          padding-top: 32px;
          border-top: 1px solid #f1f5f9;
        }

        .submit-report-btn {
          height: 48px;
          padding: 0 32px;
          background: var(--navy);
          color: #fff;
          border: none;
          border-radius: 12px;
          font-weight: 700;
          font-size: 15px;
          transition: all 0.2s;
          box-shadow: 0 10px 20px rgba(14, 43, 99, 0.15);
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .submit-report-btn:hover:not(:disabled) {
          background: #1a3f8f;
          transform: translateY(-2px);
          box-shadow: 0 15px 30px rgba(14, 43, 99, 0.2);
        }

        .submit-report-btn:active {
          transform: translateY(0);
        }

        .submit-report-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .spinner {
          width: 18px;
          height: 18px;
          border: 2.5px solid rgba(255, 255, 255, 0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 900px) {
          .request-type-guide-grid,
          .request-type-panel,
          .request-meta-grid,
          .report-field-grid {
            grid-template-columns: 1fr;
          }

          .premium-upload-zone {
            height: 320px;
          }
        }

        @media (max-width: 600px) {
          .report-form-premium {
            padding: 24px;
          }

          .report-form-footer {
            flex-direction: column-reverse;
          }

          .submit-report-btn {
            width: 100%;
          }
        }
      `}</style>
    </AppLayout>
  );
}
