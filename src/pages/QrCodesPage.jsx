import React from "react";
import { useMemo, useState } from "react";
import AppLayout from "../components/AppLayout";
import DataTable from "../components/DataTable";
import { DateInput, TextInput } from "../components/FormControls";
import SearchBar from "../components/SearchBar";
import { useQrCodes } from "../hooks/use-promotions";
import { usePromoters } from "../hooks/use-promoters";
import { useAuthStore } from "../store/auth-store";
import {
  adminCanViewAgency,
  adminCanSelectAgency,
  getAgencyId,
  getAgencyLabel,
  getAgencyName,
} from "../utils/agency";

const EMPTY_FILTERS = {
  brand: "",
  promoterId: "",
  promotionCode: "",
  startDate: "",
  endDate: "",
};

function formatDate(value) {
  if (!value) {
    return "--";
  }

  const date = new Date(String(value).replace(" ", "T"));

  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10) || "--";
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getQrDisplayName(record) {
  const rawName = record.fileName || record.imageUrl || record.code || "QR code";
  const leafName = String(rawName).split("?")[0].split("/").filter(Boolean).pop();

  try {
    return decodeURIComponent(leafName || rawName);
  } catch {
    return leafName || rawName;
  }
}

function getPromotionStatusClass(record) {
  if (record.promotionActive) {
    return "is-active";
  }

  if (record.promotionStatus === "scheduled") {
    return "is-scheduled";
  }

  if (record.promotionStatus === "expired") {
    return "is-expired";
  }

  return "is-inactive";
}

function sortQrCodes(records) {
  return [...records].sort((firstRecord, secondRecord) => {
    const firstTime = new Date(String(firstRecord.createdAt || 0).replace(" ", "T")).getTime();
    const secondTime = new Date(String(secondRecord.createdAt || 0).replace(" ", "T")).getTime();

    if (firstTime !== secondTime) {
      return secondTime - firstTime;
    }

    return [
      ["promotionCode", "promotionCode"],
      ["brandName", "brandName"],
      ["promoterId", "promoterId"],
      ["code", "code"],
    ].reduce((result, [firstKey, secondKey]) => {
      if (result !== 0) {
        return result;
      }

      return String(firstRecord[firstKey] || "").localeCompare(
        String(secondRecord[secondKey] || ""),
        undefined,
        { numeric: true, sensitivity: "base" },
      );
    }, 0);
  });
}

function recordMatchesDateRange(record, startDate, endDate) {
  const createdDate = String(record.createdAt || "").slice(0, 10);

  if ((startDate || endDate) && !createdDate) {
    return false;
  }

  return (
    (!startDate || createdDate >= startDate) &&
    (!endDate || createdDate <= endDate)
  );
}

function recordMatchesSearch(record, searchTerm) {
  const normalizedSearch = searchTerm.trim().toLowerCase();

  if (!normalizedSearch) {
    return true;
  }

  return [
    record.code,
    record.fileName,
    record.promotionCode,
    record.promotionName,
    record.promoType,
    record.promotionStatus,
    record.brandName,
    record.promoterId,
    record.promoterName,
    record.promoterEmail,
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalizedSearch));
}

function normalizePromoterKey(value) {
  return String(value ?? "").trim().toLowerCase();
}

export default function QrCodesPage() {
  const authUser = useAuthStore((state) => state.user);
  const canViewAllAgencies = adminCanSelectAgency(authUser);
  const {
    data: promoters = [],
    error: promotersError,
    isError: isPromotersError,
    isLoading: isPromotersLoading,
  } = usePromoters(!canViewAllAgencies);
  const [draftFilters, setDraftFilters] = useState(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);
  const [searchTerm, setSearchTerm] = useState("");
  const {
    data: qrCodes = [],
    error,
    isError,
    isFetching,
    isLoading,
  } = useQrCodes({
    brand: appliedFilters.brand,
    promoterId: appliedFilters.promoterId,
    promotionCode: appliedFilters.promotionCode,
    startDate: appliedFilters.startDate,
    endDate: appliedFilters.endDate,
  });
  const hasActiveFilters = Object.values(appliedFilters).some(Boolean);
  const isApplyingFilters = isFetching && hasActiveFilters;
  const qrCodesIncludeAgencyMetadata = qrCodes.some(
    (record) => Boolean(getAgencyId(record) || getAgencyName(record)),
  );
  const promotersById = useMemo(
    () =>
      new Map(
        promoters
          .filter((promoter) => promoter.promoterId)
          .map((promoter) => [
            normalizePromoterKey(promoter.promoterId),
            promoter,
          ]),
      ),
    [promoters],
  );
  const needsPromoterAgencyLookup =
    !canViewAllAgencies && !qrCodesIncludeAgencyMetadata;
  const scopedQrCodes = useMemo(
    () => {
      if (canViewAllAgencies) {
        return qrCodes;
      }

      return qrCodes.filter((record) => {
        const hasAgencyMetadata = Boolean(
          getAgencyId(record) || getAgencyName(record),
        );

        if (hasAgencyMetadata) {
          return adminCanViewAgency(authUser, record);
        }

        const promoter = promotersById.get(
          normalizePromoterKey(record.promoterId),
        );

        return Boolean(promoter && adminCanViewAgency(authUser, promoter));
      });
    },
    [authUser, canViewAllAgencies, promotersById, qrCodes],
  );
  const visibleQrCodes = useMemo(
    () =>
      sortQrCodes(
        scopedQrCodes.filter(
          (record) =>
            recordMatchesSearch(record, searchTerm) &&
            recordMatchesDateRange(
              record,
              appliedFilters.startDate,
              appliedFilters.endDate,
            ),
        ),
      ),
    [appliedFilters.endDate, appliedFilters.startDate, scopedQrCodes, searchTerm],
  );

  const updateFilter = (field, value) => {
    setDraftFilters((currentFilters) => ({
      ...currentFilters,
      [field]: value,
    }));
  };

  const applyFilters = (event) => {
    event.preventDefault();
    setAppliedFilters({
      brand: draftFilters.brand.trim(),
      promoterId: draftFilters.promoterId.trim(),
      promotionCode: draftFilters.promotionCode.trim(),
      startDate: draftFilters.startDate,
      endDate: draftFilters.endDate,
    });
  };

  const clearFilters = () => {
    setDraftFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    setSearchTerm("");
  };

  return (
    <AppLayout activeNav="qr-codes">
      <div className="main-card promotions-card qr-repository-card">
        <div className="card-header promotions-header qr-repository-header">
          <div>
            <p className="brands-admin-eyebrow">QR Repository</p>
            <h2>QR Codes</h2>
            <p>
              Browse uploaded QR codes across promotions, brands, and promoters.
            </p>
          </div>
          <span className="brands-admin-count">
            {visibleQrCodes.length} of {scopedQrCodes.length} QR codes
          </span>
        </div>

        <form className="qr-repository-toolbar" onSubmit={applyFilters} noValidate>
          <SearchBar
            ariaLabel="Search QR codes"
            onChange={setSearchTerm}
            placeholder="Search QR codes"
            value={searchTerm}
          />

          <TextInput
            id="qrRepositoryPromotionCode"
            label="Promotion Code"
            value={draftFilters.promotionCode}
            onChange={(event) => updateFilter("promotionCode", event.target.value)}
            placeholder="e.g. 598612"
          />

          <TextInput
            id="qrRepositoryBrand"
            label="Brand"
            value={draftFilters.brand}
            onChange={(event) => updateFilter("brand", event.target.value)}
            placeholder="e.g. Luckystrike"
          />

          <TextInput
            id="qrRepositoryPromoterId"
            label="Promoter ID"
            value={draftFilters.promoterId}
            onChange={(event) =>
              updateFilter("promoterId", event.target.value.toUpperCase())
            }
            placeholder="e.g. PROMO"
            maxLength={5}
          />

          <DateInput
            id="qrRepositoryStartDate"
            label="Start date"
            value={draftFilters.startDate}
            onValueChange={(value) => updateFilter("startDate", value)}
            max={draftFilters.endDate || undefined}
          />

          <DateInput
            id="qrRepositoryEndDate"
            label="End date"
            value={draftFilters.endDate}
            onValueChange={(value) => updateFilter("endDate", value)}
            min={draftFilters.startDate || undefined}
          />

          <div className="qr-repository-actions">
            <button
              type="button"
              className="brand-admin-secondary-btn"
              onClick={clearFilters}
              disabled={!hasActiveFilters && !searchTerm}
            >
              Clear
            </button>
            <button
              type="submit"
              className="brand-admin-primary-btn"
              disabled={isApplyingFilters}
            >
              {isApplyingFilters ? "Applying..." : "Apply Filters"}
            </button>
          </div>
        </form>

        <DataTable
          columns={[
            {
              header: "Date Added",
              key: "group",
              render: (record) => (
                <div className="qr-repository-group-cell">
                  <strong>{formatDate(record.createdAt)}</strong>
                  <span>
                    {record.updatedAt
                      ? `Updated ${formatDate(record.updatedAt)}`
                      : "Date added"}
                  </span>
                </div>
              ),
            },
            {
              header: "QR Code",
              key: "code",
              render: (record) => (
                <div className="qr-repository-code-cell">
                  <span className="promotion-code-pill">{record.code || "--"}</span>
                  <span>{record.fileName || "No filename"}</span>
                </div>
              ),
            },
            {
              header: "Brand",
              key: "brand",
              render: (record) => record.brandName || "--",
            },
            {
              header: "Promoter",
              key: "promoter",
              render: (record) => (
                <div className="qr-repository-code-cell">
                  <strong>{record.promoterId || "--"}</strong>
                  <span>{record.promoterEmail || record.promoterName || ""}</span>
                </div>
              ),
            },
            {
              header: "Promotion",
              key: "promotion",
              render: (record) => (
                <div className="qr-repository-code-cell">
                  <strong>{record.promotionName || "--"}</strong>
                  <span>{record.promotionCode || record.promoType || ""}</span>
                </div>
              ),
            },
            ...(canViewAllAgencies
              ? [
                  {
                    header: "Agency",
                    key: "agency",
                    render: (record) => getAgencyLabel(record),
                  },
                ]
              : []),
            {
              header: "Status",
              key: "status",
              render: (record) => (
                <span className={`promotion-status ${getPromotionStatusClass(record)}`}>
                  {record.promotionActive
                    ? "Active"
                    : record.promotionStatus || "Inactive"}
                </span>
              ),
            },
            {
              header: "File",
              key: "file",
              render: (record) => {
                const qrName = getQrDisplayName(record);

                return record.imageUrl ? (
                  <a
                    className="promotion-brand-qr-link"
                    href={record.imageUrl}
                    target="_blank"
                    rel="noreferrer"
                    title={`Open ${qrName}`}
                  >
                    View {qrName}
                  </a>
                ) : (
                  "--"
                );
              },
            },
          ]}
          dependencies={[
            appliedFilters.endDate,
            appliedFilters.startDate,
            searchTerm,
            visibleQrCodes.length,
          ]}
          emptyMessage={
            hasActiveFilters || searchTerm
              ? "No QR codes match these filters."
              : "No QR codes uploaded yet."
          }
          error={error || (needsPromoterAgencyLookup ? promotersError : null)}
          errorMessage="Unable to load QR codes right now."
          getRowKey={(record, index) => `${record.id}-${index}`}
          isError={isError || (needsPromoterAgencyLookup && isPromotersError)}
          isLoading={isLoading || (needsPromoterAgencyLookup && isPromotersLoading)}
          items={visibleQrCodes}
          loadingMessage="Loading QR codes..."
          tableClassName="data-table qr-repository-table"
        />
      </div>
    </AppLayout>
  );
}
