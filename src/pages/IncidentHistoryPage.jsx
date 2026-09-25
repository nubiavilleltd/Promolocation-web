import React from "react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import DataTable from "../components/DataTable";
import SearchBar from "../components/SearchBar";
import {
  HELP_DESK_REQUEST_TYPES,
  mockHelpDeskRequests,
} from "../data/helpDeskMock";
import { useAuthStore } from "../store/auth-store";
import { isSpecialAdminUser } from "../utils/authAccess";
import { formatLongDate, getIncidentStatusColor } from "../utils/formatters";

const STATUS_FILTERS = ["all", "Submitted", "In Progress", "Resolved", "Closed"];

const REQUEST_TYPE_COLORS = {
  incident_report: "#d97706",
  change_request: "#2563eb",
  access_request: "#159447",
};

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function SummaryIcon({ type }) {
  if (type === "awaiting") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
        <rect x="4" y="5" width="16" height="15" rx="2" />
        <path d="M8 3v4M16 3v4M4 10h16" />
        <circle cx="16.5" cy="16" r="3.5" />
        <path d="M16.5 14.5V16l1 1" />
      </svg>
    );
  }

  if (type === "progress") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
        <path d="M4 19V5M4 19h16" />
        <path d="m7 15 4-4 3 2 5-6" />
        <path d="M15 7h4v4" />
      </svg>
    );
  }

  if (type === "resolved") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
        <circle cx="12" cy="12" r="8" />
        <path d="m8.5 12 2.3 2.3 4.8-5" />
      </svg>
    );
  }

  if (type === "closed") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
        <path d="M4 8h16v11H4zM3 5h18v3H3zM9 12h6" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
      <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
      <path d="m4 7.5 8 4.5 8-4.5M12 12v9" />
    </svg>
  );
}

export default function IncidentHistoryPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [requestType, setRequestType] = useState("all");
  const [status, setStatus] = useState("all");
  const authUser = useAuthStore((state) => state.user);
  const canCreateRequest = isSpecialAdminUser(authUser);
  const navigate = useNavigate();

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  const filteredRequests = useMemo(
    () =>
      mockHelpDeskRequests.filter((request) => {
        const matchesSearch = [
          request.id,
          request.issue,
          request.category,
          request.status,
          request.requestTypeLabel,
          request.requesterName,
          request.priority,
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearchTerm);
        const matchesType =
          requestType === "all" || request.requestType === requestType;
        const matchesStatus = status === "all" || request.status === status;

        return matchesSearch && matchesType && matchesStatus;
      }),
    [normalizedSearchTerm, requestType, status],
  );
  const requestSummary = useMemo(
    () =>
      mockHelpDeskRequests.reduce(
        (summary, request) => ({
          ...summary,
          [request.status]: (summary[request.status] || 0) + 1,
        }),
        {},
      ),
    [],
  );
  const actionRequiredCount = canCreateRequest
    ? requestSummary.Resolved || 0
    : (requestSummary.Submitted || 0) + (requestSummary["Not Resolved"] || 0);
  const hasActiveFilters = requestType !== "all" || status !== "all" || Boolean(searchTerm);
  const resultCountLabel =
    hasActiveFilters && filteredRequests.length !== mockHelpDeskRequests.length
      ? `${filteredRequests.length} ${filteredRequests.length === 1 ? "result" : "results"}`
      : null;
  const summaryItems = [
    {
      label: "All Requests",
      count: mockHelpDeskRequests.length,
      detail: "Total",
      icon: "all",
      color: "blue",
    },
    {
      label: "Awaiting Your Review",
      count: actionRequiredCount,
      detail: "Needs your action",
      icon: "awaiting",
      color: "orange",
    },
    {
      label: "In Progress",
      count: requestSummary["In Progress"] || 0,
      detail: "Being worked on",
      icon: "progress",
      color: "green",
    },
    {
      label: "Resolved",
      count: requestSummary.Resolved || 0,
      detail: "Completed",
      icon: "resolved",
      color: "purple",
    },
    {
      label: "Closed",
      count: requestSummary.Closed || 0,
      detail: "Closed",
      icon: "closed",
      color: "slate",
    },
  ];

  return (
    <AppLayout activeNav="incidents" mainContentClassName="promoters-main requests-main">
      <div className="requests-page">
        <div className="requests-page-header">
          <div>
            <h1>All Requests</h1>
            <p>Review incidents, change requests, access requests, and follow-up decisions.</p>
          </div>
          {canCreateRequest ? (
            <button
              type="button"
              className="requests-primary-btn"
              onClick={() => navigate("/report_incident")}
            >
              <PlusIcon />
              New Request
            </button>
          ) : null}
        </div>

        <div className="requests-summary-strip">
          {summaryItems.map((item) => (
            <div
              className={`requests-summary-item requests-summary-item--${item.color}`}
              key={item.label}
            >
              <span className="requests-summary-icon">
                <SummaryIcon type={item.icon} />
              </span>
              <span className="requests-summary-copy">
                <span className="requests-summary-label">{item.label}</span>
                <strong>{item.count}</strong>
                <span className="requests-summary-detail">{item.detail}</span>
              </span>
            </div>
          ))}
        </div>

        <div className="requests-toolbar">
          <div className="requests-filter-group" aria-label="Status filters">
            {STATUS_FILTERS.map((statusOption) => {
              const isAllFilter = statusOption === "all";
              const statusColor = getIncidentStatusColor(statusOption);

              return (
                <button
                  type="button"
                  key={statusOption}
                  className={`requests-filter-chip${status === statusOption ? " is-selected" : ""}`}
                  onClick={() => setStatus(statusOption)}
                  style={isAllFilter ? undefined : { "--chip-color": statusColor }}
                >
                  <span>{isAllFilter ? "All" : statusOption}</span>
                  <strong>
                    {isAllFilter
                      ? mockHelpDeskRequests.length
                      : requestSummary[statusOption] || 0}
                  </strong>
                </button>
              );
            })}
          </div>

          <SearchBar
            className="requests-search"
            ariaLabel="Search help desk requests"
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search requests by title, ID, requester..."
          />

          <label className="requests-type-filter">
            <span>Request Type</span>
            <select value={requestType} onChange={(event) => setRequestType(event.target.value)}>
              <option value="all">All types</option>
              {HELP_DESK_REQUEST_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>

          {resultCountLabel ? <span className="requests-result-count">{resultCountLabel}</span> : null}
        </div>

        <DataTable
          columns={[
            {
              header: "Request",
              key: "request",
              headerClassName: "help-desk-request-col",
              cellClassName: "help-desk-request-col",
              render: (request) => (
                <div className="requests-request-cell">
                  <strong title={request.issue}>{request.issue}</strong>
                  <span title={`${request.id} · ${request.category}`}>
                    {request.id} · {request.category}
                  </span>
                </div>
              ),
            },
            {
              header: "Type",
              key: "type",
              headerClassName: "help-desk-type-col",
              cellClassName: "help-desk-type-col",
              render: (request) => (
                <span className="requests-type-cell">
                  <span
                    className="requests-type-dot"
                    style={{
                      backgroundColor: REQUEST_TYPE_COLORS[request.requestType] || "#64748b",
                    }}
                  />
                  {request.requestTypeLabel}
                </span>
              ),
            },
            {
              header: "Requester",
              key: "requester",
              headerClassName: "help-desk-requester-col",
              cellClassName: "help-desk-requester-col",
              render: (request) => (
                <div className="requests-requester-cell">
                  <strong title={request.requesterName}>{request.requesterName}</strong>
                </div>
              ),
            },
            {
              header: "Submitted",
              key: "date",
              headerClassName: "help-desk-date-col",
              cellClassName: "help-desk-date-col",
              render: (request) => (
                <span className="help-desk-relative-time">{formatLongDate(request.date)}</span>
              ),
            },
            {
              header: "Status",
              key: "status",
              headerClassName: "help-desk-status-col",
              cellClassName: "help-desk-status-col",
              render: (request) => (
                <span
                  className="status-pill help-desk-status-pill"
                  style={{
                    color: getIncidentStatusColor(request.status),
                    backgroundColor: `${getIncidentStatusColor(request.status)}14`,
                  }}
                >
                  <span
                    className="help-desk-status-dot"
                    style={{ backgroundColor: getIncidentStatusColor(request.status) }}
                  />
                  {request.status}
                </span>
              ),
            },
          ]}
          dependencies={[searchTerm, requestType, status, filteredRequests.length]}
          emptyMessage="No help desk requests match your filters."
          getRowKey={(request) => request.id}
          items={filteredRequests}
          footerContent={({ currentPage, pageSize, paginatedItems }) => {
            const start = filteredRequests.length ? currentPage * pageSize + 1 : 0;
            const end = filteredRequests.length ? start + paginatedItems.length - 1 : 0;

            return (
              <span className="requests-table-count">
                Showing {start} to {end} of {filteredRequests.length} requests
              </span>
            );
          }}
          alwaysShowPagination
          pageSize={4}
          rowProps={(request) => ({
            className: "clickable-row help-desk-row",
            role: "link",
            tabIndex: 0,
            onClick: () => navigate(`/incidents/${request.id}`),
            onKeyDown: (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                navigate(`/incidents/${request.id}`);
              }
            },
          })}
          footerClassName="requests-table-footer"
          tableId="incidentHistoryTable"
        />
      </div>
    </AppLayout>
  );
}
