export const HELP_DESK_REQUEST_TYPES = [
  {
    value: "incident_report",
    label: "Incident Report",
    description: "In-app issues.",
  },
  {
    value: "change_request",
    label: "Change Request",
    description: "Updates to promotions, agencies, brands, or promoter details.",
  },
  {
    value: "access_request",
    label: "Access Request",
    description: "New account access, permission changes, or role grants.",
  },
];

export const HELP_DESK_STATUSES = [
  "Submitted",
  "In Progress",
  "On Hold",
  "Resolved",
  "Not Resolved",
  "Closed",
];

export const mockHelpDeskRequests = [
  {
    id: "REQ-1007",
    requestType: "change_request",
    requestTypeLabel: "Change Request",
    issue: "Create Skyline agency and onboard new promoter batch",
    category: "Agency & Promoter Change",
    description:
      "Please create the Skyline agency, then add 12 new promoters assigned to that agency. The requester will send the final promoter list after approval.",
    status: "Submitted",
    priority: "High",
    requesterName: "Amina Yusuf",
    requesterRole: "specialadmin",
    date: "2026-08-31 09:15:00",
    image: null,
    adminNote: null,
    affectedRecords: ["Agency: Skyline", "Promoters: 12 pending records"],
    resolutionSummary: "",
    auditTrail: [
      {
        id: "AUD-1007-1",
        userId: "165",
        action: "Submitted setup request",
        comment: "New agency and promoter batch required before next promotion cycle.",
        dateTime: "2026-08-31 09:15:00",
      },
    ],
  },
  {
    id: "REQ-1006",
    requestType: "access_request",
    requestTypeLabel: "Access Request",
    issue: "Grant Zipline admin access to regional supervisor",
    category: "Access Management",
    description:
      "Regional supervisor needs dashboard access for Zipline only. Access should not include all-agency visibility.",
    status: "In Progress",
    priority: "Medium",
    requesterName: "Daniel Okafor",
    requesterRole: "specialadmin",
    date: "2026-08-30 14:40:00",
    image: null,
    adminNote: "Identity confirmed. Creating scoped admin account.",
    affectedRecords: ["Agency: Zipline", "Role: admin"],
    resolutionSummary: "",
    auditTrail: [
      {
        id: "AUD-1006-1",
        userId: "168",
        action: "Submitted access request",
        comment: "Supervisor needs scoped dashboard access.",
        dateTime: "2026-08-30 14:40:00",
      },
      {
        id: "AUD-1006-2",
        userId: "42",
        action: "Moved request to In Progress",
        comment: "Identity confirmed. Creating scoped admin account.",
        dateTime: "2026-08-30 15:05:00",
      },
    ],
  },
  {
    id: "REQ-1005",
    requestType: "incident_report",
    requestTypeLabel: "Incident Report",
    issue: "QR code scan failing for active promotion",
    category: "QR Issue",
    description:
      "Several promoters reported that the QR code opens a blank page during customer engagement. The issue appears limited to one promotion.",
    status: "Resolved",
    priority: "High",
    requesterName: "Maya Chen",
    requesterRole: "specialadmin",
    date: "2026-08-29 11:20:00",
    image: "assets/test1.png",
    adminNote:
      "QR destination was corrected and the affected promotion assignment records were refreshed.",
    affectedRecords: ["Promotion: Back to School Push", "Brand: Luckystrike"],
    resolutionSummary:
      "Corrected the QR target URL, refreshed assignment records, and confirmed scans load the expected landing page.",
    auditTrail: [
      {
        id: "AUD-1005-1",
        userId: "171",
        action: "Submitted incident report",
        comment: "QR opens a blank page during field activation.",
        dateTime: "2026-08-29 11:20:00",
      },
      {
        id: "AUD-1005-2",
        userId: "42",
        action: "Moved request to In Progress",
        comment: "Checking QR destination and assignment rows.",
        dateTime: "2026-08-29 11:42:00",
      },
      {
        id: "AUD-1005-3",
        userId: "42",
        action: "Marked request Resolved",
        comment: "QR destination corrected and records refreshed.",
        dateTime: "2026-08-29 12:18:00",
      },
    ],
  },
  {
    id: "REQ-1004",
    requestType: "change_request",
    requestTypeLabel: "Change Request",
    issue: "Add two new brands to the system catalog",
    category: "Brand Setup",
    description:
      "Add two approved brands to the global brand catalog with their logos so they can be assigned to upcoming promotions.",
    status: "Closed",
    priority: "Low",
    requesterName: "Fatima Bello",
    requesterRole: "specialadmin",
    date: "2026-08-27 16:25:00",
    image: null,
    adminNote: "Brands added and confirmed by requester.",
    affectedRecords: ["Brands: 2"],
    resolutionSummary: "Both brands were added to the global brand catalog.",
    auditTrail: [
      {
        id: "AUD-1004-1",
        userId: "166",
        action: "Submitted setup request",
        comment: "Two brands need to be available for next week.",
        dateTime: "2026-08-27 16:25:00",
      },
      {
        id: "AUD-1004-2",
        userId: "42",
        action: "Marked request Resolved",
        comment: "Brands added to catalog.",
        dateTime: "2026-08-27 17:10:00",
      },
      {
        id: "AUD-1004-3",
        userId: "166",
        action: "Closed request",
        comment: "Confirmed.",
        dateTime: "2026-08-27 17:35:00",
      },
    ],
  },
];

export function getHelpDeskRequestById(requestId) {
  return mockHelpDeskRequests.find((request) => request.id === requestId);
}
