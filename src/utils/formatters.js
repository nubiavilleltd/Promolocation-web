export function getOrdinalSuffix(value) {
  if (value > 3 && value < 21) {
    return "th";
  }

  switch (value % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

export function formatLongDate(dateString) {
  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  const day = date.getDate();
  const month = date.toLocaleString("en-US", { month: "long" });
  const year = date.getFullYear();
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const meridiem = hours >= 12 ? "pm" : "am";
  const displayHour = hours % 12 || 12;

  return `${day}${getOrdinalSuffix(day)} ${month}, ${year} at ${displayHour}:${minutes}${meridiem}`;
}

export function getVisiblePages(currentPage, totalPages) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index);
  }

  if (currentPage <= 2) {
    return [0, 1, 2, 3, "...", totalPages - 1];
  }

  if (currentPage >= totalPages - 3) {
    return [0, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1];
  }

  return [0, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages - 1];
}

export function getPromoterStatusColor(status) {
  if (status === "Active") {
    return "#22C55E";
  }

  if (status === "Pending") {
    return "#EAB308";
  }

  return "#EF4444";
}

export function getIncidentStatusColor(status) {
  const statusColors = {
    Resolved: "#16A34A",
    Closed: "#64748B",
    "In Progress": "#2563EB",
    "On Hold": "#F97316",
    Pending: "#EAB308",
    "Not Resolved": "#DC2626",
    Active: "#22C55E",
    Inactive: "#94A3B8",
  };

  return statusColors[status] || "#6B7280";
}
