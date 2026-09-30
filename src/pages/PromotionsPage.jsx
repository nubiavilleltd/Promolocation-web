import React from "react";
import { useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import jsQR from "jsqr";
import Swal from "sweetalert2";
import AppLayout from "../components/AppLayout";
import DataTable from "../components/DataTable";
import {
  AssignmentIcon,
  CopyIcon,
} from "../components/promotion-assignment/AssignmentWidgets";
import {
  Button,
  DateInput,
  FileInput,
  FormErrorSummary,
  SelectInput,
  TextArea,
  TextInput,
} from "../components/FormControls";
import Modal from "../components/Modal";
import SearchBar from "../components/SearchBar";
import {
  useCreatePromotion,
  usePromotionBrands,
  usePromotions,
  useUpdatePromotion,
  useUploadPromotionQrCodesBulk,
} from "../hooks/use-promotions";
import { agencyKeys, useAgencies } from "../hooks/use-agencies";
import {
  useCreatePromoterBrand,
  useDeletePromoterBrand,
  useImportBrandsCategory,
  useSystemBrands,
  useUpdatePromoterBrand,
} from "../hooks/use-promoters-brands";
import { usePromoters } from "../hooks/use-promoters";
import { useAuthStore } from "../store/auth-store";
import {
  adminCanSelectAgency,
  getAgencyLabel,
  getAgencyId,
  scopeRecordsByAgency,
} from "../utils/agency";
import {
  validateFileSize,
  validateImageUpload,
} from "../utils/imageUploadValidation";
import {
  canManagePromotion,
  findPromotionScheduleConflict,
  formatDate,
  getPromotionCode,
  getPromotionState,
  hasSamePromotionId,
  isCurrentlyActivePromotion,
  sortPromotions,
} from "../utils/promotionViewHelpers";

const EMPTY_PROMOTION_FORM = {
  name: "",
  description: "",
  startDate: "",
  endDate: "",
  status: "",
  agency: "",
};
const PROMOTION_UPLOAD_FILE_BASENAME = "Promotion Management";
const PROMOTION_UPLOAD_ACCEPT = ".csv,.xlsx,.xls";
const PROMOTION_QR_ZIP_ACCEPT = ".zip";
const PROMOTION_QR_IMAGE_EXTENSIONS = ["png", "jpg", "jpeg"];
const PROMOTION_STATUS_OPTIONS = [
  { label: "Scheduled", value: "scheduled" },
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
  { label: "Expired", value: "expired" },
];
const PROMOTION_FILTER_OPTIONS = [
  { label: "All statuses", value: "all" },
  { label: "Active", value: "active" },
  { label: "Scheduled", value: "scheduled" },
  { label: "Inactive", value: "inactive" },
  { label: "Expired", value: "expired" },
];

function getFileExtension(fileName) {
  return String(fileName || "").split(".").pop()?.toLowerCase() || "";
}

function getFileBaseName(fileName) {
  const normalizedFileName = String(fileName || "");
  const extension = getFileExtension(normalizedFileName);

  return extension
    ? normalizedFileName.slice(0, -(extension.length + 1))
    : normalizedFileName;
}

function deriveCreatePromotionStatus(startDate, endDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const parsedStartDate = startDate ? new Date(`${startDate}T00:00:00`) : null;
  const parsedEndDate = endDate ? new Date(`${endDate}T00:00:00`) : null;

  if (parsedEndDate && parsedEndDate < today) {
    return "expired";
  }

  if (parsedStartDate && parsedStartDate > today) {
    return "scheduled";
  }

  return "active";
}

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function createCrc32Table() {
  return Array.from({ length: 256 }, (_, index) => {
    let value = index;

    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }

    return value >>> 0;
  });
}

const CRC32_TABLE = createCrc32Table();

function getCrc32(bytes) {
  let crc = 0xffffffff;

  for (const byte of bytes) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function createZipBlob(files) {
  const encoder = new TextEncoder();
  const chunks = [];
  const centralDirectoryChunks = [];
  let offset = 0;

  const writeUint16 = (value) => [value & 0xff, (value >>> 8) & 0xff];
  const writeUint32 = (value) => [
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff,
  ];
  const today = new Date();
  const zipTime =
    (today.getHours() << 11) | (today.getMinutes() << 5) | (today.getSeconds() / 2);
  const zipDate =
    ((today.getFullYear() - 1980) << 9) |
    ((today.getMonth() + 1) << 5) |
    today.getDate();

  files.forEach(({ name, content }) => {
    const nameBytes = encoder.encode(name);
    const contentBytes = encoder.encode(content);
    const crc = getCrc32(contentBytes);
    const localHeader = new Uint8Array([
      ...writeUint32(0x04034b50),
      ...writeUint16(20),
      ...writeUint16(0),
      ...writeUint16(0),
      ...writeUint16(zipTime),
      ...writeUint16(zipDate),
      ...writeUint32(crc),
      ...writeUint32(contentBytes.length),
      ...writeUint32(contentBytes.length),
      ...writeUint16(nameBytes.length),
      ...writeUint16(0),
    ]);
    const centralDirectoryHeader = new Uint8Array([
      ...writeUint32(0x02014b50),
      ...writeUint16(20),
      ...writeUint16(20),
      ...writeUint16(0),
      ...writeUint16(0),
      ...writeUint16(zipTime),
      ...writeUint16(zipDate),
      ...writeUint32(crc),
      ...writeUint32(contentBytes.length),
      ...writeUint32(contentBytes.length),
      ...writeUint16(nameBytes.length),
      ...writeUint16(0),
      ...writeUint16(0),
      ...writeUint16(0),
      ...writeUint16(0),
      ...writeUint32(0),
      ...writeUint32(offset),
    ]);

    chunks.push(localHeader, nameBytes, contentBytes);
    centralDirectoryChunks.push(centralDirectoryHeader, nameBytes);
    offset += localHeader.length + nameBytes.length + contentBytes.length;
  });

  const centralDirectoryOffset = offset;
  const centralDirectorySize = centralDirectoryChunks.reduce(
    (size, chunk) => size + chunk.length,
    0,
  );
  const endOfCentralDirectory = new Uint8Array([
    ...writeUint32(0x06054b50),
    ...writeUint16(0),
    ...writeUint16(0),
    ...writeUint16(files.length),
    ...writeUint16(files.length),
    ...writeUint32(centralDirectorySize),
    ...writeUint32(centralDirectoryOffset),
    ...writeUint16(0),
  ]);

  return new Blob([...chunks, ...centralDirectoryChunks, endOfCentralDirectory], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

function buildInlineStringCell(reference, value, style = "") {
  return `<c r="${reference}" t="inlineStr"${style ? ` s="${style}"` : ""}><is><t>${escapeXml(value)}</t></is></c>`;
}

function createPromotionWorkbookTemplateBlob(promotionCode) {
  const worksheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:D2"/>
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <cols><col min="1" max="1" width="22" customWidth="1"/><col min="2" max="2" width="22" customWidth="1"/><col min="3" max="3" width="24" customWidth="1"/><col min="4" max="4" width="28" customWidth="1"/></cols>
  <sheetData>
    <row r="1">
      ${buildInlineStringCell("A1", "promotion_code", "1")}
      ${buildInlineStringCell("B1", "promoter_code", "1")}
      ${buildInlineStringCell("C1", "brand", "1")}
      ${buildInlineStringCell("D1", "qr code", "1")}
    </row>
    <row r="2">
      ${buildInlineStringCell("A2", promotionCode)}
      ${buildInlineStringCell("B2", "")}
      ${buildInlineStringCell("C2", "")}
      ${buildInlineStringCell("D2", "")}
    </row>
  </sheetData>
</worksheet>`;

  return createZipBlob([
    {
      name: "[Content_Types].xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`,
    },
    {
      name: "_rels/.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`,
    },
    {
      name: "docProps/app.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Promolocation</Application>
</Properties>`,
    },
    {
      name: "docProps/core.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>Promotion Management Template</dc:title>
  <dc:creator>Promolocation</dc:creator>
  <cp:lastModifiedBy>Promolocation</cp:lastModifiedBy>
</cp:coreProperties>`,
    },
    {
      name: "xl/workbook.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Promotion Management" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
    },
    {
      name: "xl/styles.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
  <fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>
</styleSheet>`,
    },
    {
      name: "xl/worksheets/sheet1.xml",
      content: worksheetXml,
    },
  ]);
}

function downloadPromotionWorkbookTemplate(promotionCode) {
  const blob = createPromotionWorkbookTemplateBlob(promotionCode);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `${PROMOTION_UPLOAD_FILE_BASENAME}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function validatePromotionUploadFileName(file) {
  if (!file) {
    return "Choose the Promotion Management file.";
  }

  const allowedFileNamePattern = new RegExp(
    `^${PROMOTION_UPLOAD_FILE_BASENAME.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}( \\([1-9][0-9]*\\))?$`,
  );

  if (!allowedFileNamePattern.test(getFileBaseName(file.name))) {
    return `The file name must be ${PROMOTION_UPLOAD_FILE_BASENAME}, or a numbered browser copy like ${PROMOTION_UPLOAD_FILE_BASENAME} (1).`;
  }

  return "";
}

function parseCsvLine(line) {
  const cells = [];
  let currentCell = "";
  let isQuoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"' && isQuoted && nextCharacter === '"') {
      currentCell += '"';
      index += 1;
      continue;
    }

    if (character === '"') {
      isQuoted = !isQuoted;
      continue;
    }

    if (character === "," && !isQuoted) {
      cells.push(currentCell.trim());
      currentCell = "";
      continue;
    }

    currentCell += character;
  }

  cells.push(currentCell.trim());
  return cells;
}

function normalizeWorkbookHeader(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeBrandName(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function normalizeExactBrandName(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .toLowerCase();
}

function getLevenshteinDistance(firstValue, secondValue) {
  const first = String(firstValue || "");
  const second = String(secondValue || "");
  const distances = Array.from({ length: first.length + 1 }, (_, index) => [
    index,
  ]);

  for (let secondIndex = 1; secondIndex <= second.length; secondIndex += 1) {
    distances[0][secondIndex] = secondIndex;
  }

  for (let firstIndex = 1; firstIndex <= first.length; firstIndex += 1) {
    for (let secondIndex = 1; secondIndex <= second.length; secondIndex += 1) {
      const substitutionCost =
        first[firstIndex - 1] === second[secondIndex - 1] ? 0 : 1;

      distances[firstIndex][secondIndex] = Math.min(
        distances[firstIndex - 1][secondIndex] + 1,
        distances[firstIndex][secondIndex - 1] + 1,
        distances[firstIndex - 1][secondIndex - 1] + substitutionCost,
      );
    }
  }

  return distances[first.length][second.length];
}

function getBrandSuggestion(brand, systemBrands = []) {
  const normalizedLooseBrand = normalizeBrandName(brand);
  const normalizedExactBrand = normalizeExactBrandName(brand);

  const looseMatch = systemBrands.find(
    (systemBrand) =>
      normalizeBrandName(systemBrand.name) === normalizedLooseBrand,
  );

  if (looseMatch?.name) {
    return looseMatch.name;
  }

  const closestMatch = systemBrands
    .map((systemBrand) => ({
      name: systemBrand.name,
      distance: getLevenshteinDistance(
        normalizedExactBrand,
        normalizeExactBrandName(systemBrand.name),
      ),
    }))
    .filter(({ name }) => name)
    .sort((firstMatch, secondMatch) => firstMatch.distance - secondMatch.distance)[0];

  if (!closestMatch) {
    return "";
  }

  const maxDistance = normalizedExactBrand.length <= 8 ? 2 : 3;

  return closestMatch.distance <= maxDistance ? closestMatch.name : "";
}

function normalizePromoterCode(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeQrReference(value) {
  const text = String(value || "").trim();

  if (!text) {
    return "";
  }

  const rawLeafName = getZipLeafName(text.split("?")[0]);
  let leafName = rawLeafName;

  try {
    leafName = decodeURIComponent(rawLeafName);
  } catch {
    leafName = rawLeafName;
  }

  const baseName = getFileBaseName(leafName);

  return (baseName || text).trim().toLowerCase();
}

function getQrDisplayName(value, fallback = "QR code") {
  const text = String(value || "").trim();

  if (!text) {
    return fallback;
  }

  const rawLeafName = getZipLeafName(text.split("?")[0]);
  let leafName = rawLeafName;

  try {
    leafName = decodeURIComponent(rawLeafName);
  } catch {
    leafName = rawLeafName;
  }

  return leafName || fallback;
}

function getBrandValidationErrors({ brand, exactBrandNames, rowNumber, systemBrands }) {
  if (!exactBrandNames.has(normalizeExactBrandName(brand))) {
    const suggestion = getBrandSuggestion(brand, systemBrands);

    return [
      suggestion
        ? `Row ${rowNumber} uses brand "${brand}", but that brand does not exist. Did you mean "${suggestion}"?`
        : `Row ${rowNumber} uses brand "${brand}", but that brand does not exist.`,
    ];
  }

  return [];
}

function validateWorkbookRows(
  rows,
  promoId,
  systemBrands = [],
  promoters = [],
  agencyLabel = "this promotion",
) {
  const expectedHeaders = ["promotion_code", "promoter_code", "brand", "qr code"];
  const headers = rows[0]?.map(normalizeWorkbookHeader) || [];
  const exactBrandNames = new Set(
    systemBrands.map((brand) => normalizeExactBrandName(brand.name)),
  );
  const promoterCodes = new Set(
    promoters.flatMap((promoter) =>
      [promoter.promoterId, promoter.promoterCode].map(normalizePromoterCode),
    ).filter(Boolean),
  );
  const errors = [];
  const hasExactHeaders =
    headers.length === expectedHeaders.length &&
    expectedHeaders.every((expectedHeader, index) => headers[index] === expectedHeader);

  if (!hasExactHeaders) {
    errors.push(`Workbook headers must be exactly: ${expectedHeaders.join(", ")}.`);
    return errors;
  }

  const dataRows = rows
    .slice(1)
    .map((row, index) => ({ rowNumber: index + 2, values: row }))
    .filter(({ values }) => values.some((value) => String(value || "").trim()));

  if (!dataRows.length) {
    errors.push("Add at least one promoter-brand row before uploading the workbook.");
    return errors;
  }

  const workbookPromotionCode = dataRows
    .map(({ values }) => String(values[0] || "").trim())
    .find(Boolean);

  if (!workbookPromotionCode) {
    errors.push(`At least one row must include promotion_code ${promoId}.`);
  } else if (workbookPromotionCode !== String(promoId)) {
    errors.push(`The workbook promotion_code must be ${promoId}.`);
  }

  const workbookQrReferences = new Map();
  const workbookAssignmentReferences = new Map();

  for (const { rowNumber, values } of dataRows) {
    const promotionCode = String(values[0] || "").trim();
    const promoterCode = String(values[1] || "").trim();
    const brand = String(values[2] || "").trim();
    const qrCode = String(values[3] || "").trim();
   

    if (promotionCode && promotionCode !== String(promoId)) {
      errors.push(`Row ${rowNumber} must use promotion_code ${promoId}.`);
    }

    if (!promoterCode || !brand || !qrCode) {
      errors.push(`Row ${rowNumber} must include promoter_code, brand, and qr code.`);
      continue;
    }

    if (promoterCode.length > 5) {
      errors.push(`Row ${rowNumber} promoter_code must be 5 characters or fewer.`);
    }

    if (promoterCodes.size && !promoterCodes.has(normalizePromoterCode(promoterCode))) {
      errors.push(`Row ${rowNumber} uses promoter_code "${promoterCode}", but that promoter does not exist in ${agencyLabel}.`);
    }

    errors.push(...getBrandValidationErrors({
      brand,
      exactBrandNames,
      rowNumber,
      systemBrands,
    }));

    const normalizedAssignmentKey = [
      String(promoId),
      normalizePromoterCode(promoterCode),
      normalizeExactBrandName(brand),
    ].join("|");

    if (workbookAssignmentReferences.has(normalizedAssignmentKey)) {
      errors.push(
        `Row ${rowNumber} repeats promoter "${promoterCode}" with brand "${brand}" from row ${workbookAssignmentReferences.get(normalizedAssignmentKey)}.`,
      );
    } else {
      workbookAssignmentReferences.set(normalizedAssignmentKey, rowNumber);
    }

    const normalizedWorkbookQrCode = normalizeQrReference(qrCode);
    const qrCodeExtension = getFileExtension(getZipLeafName(qrCode.split("?")[0]));

    if (!PROMOTION_QR_IMAGE_EXTENSIONS.includes(qrCodeExtension)) {
      errors.push(
        `Row ${rowNumber} qr code "${qrCode}" must reference a PNG, JPG, or JPEG image.`,
      );
    }

    if (workbookQrReferences.has(normalizedWorkbookQrCode)) {
      errors.push(
        `Row ${rowNumber} uses qr code "${qrCode}", which duplicates row ${workbookQrReferences.get(normalizedWorkbookQrCode)}.`,
      );
    } else {
      workbookQrReferences.set(normalizedWorkbookQrCode, rowNumber);
    }
  }

  return errors;
}

async function inflateRawZipEntry(bytes) {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("This browser cannot inspect compressed XLSX files.");
  }

  const stream = new Blob([bytes]).stream().pipeThrough(
    new DecompressionStream("deflate-raw"),
  );
  const buffer = await new Response(stream).arrayBuffer();

  return new Uint8Array(buffer);
}

function findEndOfCentralDirectory(view) {
  for (let offset = view.byteLength - 22; offset >= 0; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      return offset;
    }
  }

  return -1;
}

async function readZipTextEntries(file) {
  const buffer = await file.arrayBuffer();
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const decoder = new TextDecoder();
  const endOffset = findEndOfCentralDirectory(view);

  if (endOffset < 0) {
    throw new Error("The XLSX file could not be inspected.");
  }

  const entryCount = view.getUint16(endOffset + 10, true);
  let directoryOffset = view.getUint32(endOffset + 16, true);
  const entries = {};

  for (let entryIndex = 0; entryIndex < entryCount; entryIndex += 1) {
    if (view.getUint32(directoryOffset, true) !== 0x02014b50) {
      throw new Error("The XLSX directory is invalid.");
    }

    const compressionMethod = view.getUint16(directoryOffset + 10, true);
    const compressedSize = view.getUint32(directoryOffset + 20, true);
    const fileNameLength = view.getUint16(directoryOffset + 28, true);
    const extraLength = view.getUint16(directoryOffset + 30, true);
    const commentLength = view.getUint16(directoryOffset + 32, true);
    const localHeaderOffset = view.getUint32(directoryOffset + 42, true);
    const fileName = decoder.decode(
      bytes.slice(directoryOffset + 46, directoryOffset + 46 + fileNameLength),
    );
    const localFileNameLength = view.getUint16(localHeaderOffset + 26, true);
    const localExtraLength = view.getUint16(localHeaderOffset + 28, true);
    const dataOffset = localHeaderOffset + 30 + localFileNameLength + localExtraLength;
    const compressedBytes = bytes.slice(dataOffset, dataOffset + compressedSize);
    let entryBytes;

    if (compressionMethod === 0) {
      entryBytes = compressedBytes;
    } else if (compressionMethod === 8) {
      entryBytes = await inflateRawZipEntry(compressedBytes);
    } else {
      throw new Error("The XLSX file uses an unsupported compression format.");
    }

    entries[fileName] = decoder.decode(entryBytes);
    directoryOffset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

async function readZipEntries(file) {
  const buffer = await file.arrayBuffer();
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const decoder = new TextDecoder();
  const endOffset = findEndOfCentralDirectory(view);

  if (endOffset < 0) {
    throw new Error("The zip file could not be inspected.");
  }

  const entryCount = view.getUint16(endOffset + 10, true);
  let directoryOffset = view.getUint32(endOffset + 16, true);
  const entries = [];

  for (let entryIndex = 0; entryIndex < entryCount; entryIndex += 1) {
    if (view.getUint32(directoryOffset, true) !== 0x02014b50) {
      throw new Error("The zip directory is invalid.");
    }

    const compressionMethod = view.getUint16(directoryOffset + 10, true);
    const compressedSize = view.getUint32(directoryOffset + 20, true);
    const uncompressedSize = view.getUint32(directoryOffset + 24, true);
    const fileNameLength = view.getUint16(directoryOffset + 28, true);
    const extraLength = view.getUint16(directoryOffset + 30, true);
    const commentLength = view.getUint16(directoryOffset + 32, true);
    const localHeaderOffset = view.getUint32(directoryOffset + 42, true);
    const fileName = decoder.decode(
      bytes.slice(directoryOffset + 46, directoryOffset + 46 + fileNameLength),
    );
    const isDirectory = fileName.endsWith("/");
    let entryBytes = new Uint8Array();

    if (!isDirectory) {
      const localFileNameLength = view.getUint16(localHeaderOffset + 26, true);
      const localExtraLength = view.getUint16(localHeaderOffset + 28, true);
      const dataOffset = localHeaderOffset + 30 + localFileNameLength + localExtraLength;
      const compressedBytes = bytes.slice(dataOffset, dataOffset + compressedSize);

      if (compressionMethod === 0) {
        entryBytes = compressedBytes;
      } else if (compressionMethod === 8) {
        entryBytes = await inflateRawZipEntry(compressedBytes);
      } else {
        throw new Error(
          `${fileName} uses an unsupported zip compression format.`,
        );
      }
    }

    entries.push({
      bytes: entryBytes,
      compressedSize,
      name: fileName,
      uncompressedSize,
      isDirectory,
    });
    directoryOffset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function getXmlTextContent(xmlDocument, selector) {
  return xmlDocument.querySelector(selector)?.textContent || "";
}

function getCellColumnIndex(reference) {
  const letters = String(reference || "").match(/^[A-Z]+/i)?.[0]?.toUpperCase();

  if (!letters) {
    return 0;
  }

  return letters.split("").reduce(
    (columnNumber, letter) => columnNumber * 26 + letter.charCodeAt(0) - 64,
    0,
  ) - 1;
}

function parseXlsxRowsFromXml(sheetXml, sharedStringsXml = "") {
  const parser = new DOMParser();
  const sheetDocument = parser.parseFromString(sheetXml, "application/xml");
  const sharedStrings = sharedStringsXml
    ? Array.from(
        parser
          .parseFromString(sharedStringsXml, "application/xml")
          .querySelectorAll("si"),
      ).map((item) =>
        Array.from(item.querySelectorAll("t"))
          .map((textNode) => textNode.textContent || "")
          .join(""),
      )
    : [];

  return Array.from(sheetDocument.querySelectorAll("sheetData row")).map((row) => {
    const values = [];

    Array.from(row.querySelectorAll("c")).forEach((cell) => {
      const type = cell.getAttribute("t");
      const columnIndex = getCellColumnIndex(cell.getAttribute("r"));
      let value;

      if (type === "s") {
        value = sharedStrings[Number(getXmlTextContent(cell, "v"))] || "";
      } else if (type === "inlineStr") {
        value = getXmlTextContent(cell, "is t");
      } else {
        value = getXmlTextContent(cell, "v");
      }

      values[columnIndex] = value;
    });

    return values.map((value) => value || "");
  });
}

async function parsePromotionWorkbookRows(file) {
  const extension = getFileExtension(file.name);

  if (extension === "csv") {
    const text = await file.text();
    return text
      .split(/\r?\n/)
      .filter((line) => line.trim())
      .map(parseCsvLine);
  }

  if (extension === "xlsx") {
    const entries = await readZipTextEntries(file);
    const sheetXml = entries["xl/worksheets/sheet1.xml"];

    if (!sheetXml) {
      throw new Error("The XLSX file must include a first worksheet.");
    }

    return parseXlsxRowsFromXml(sheetXml, entries["xl/sharedStrings.xml"]);
  }

  if (extension === "xls") {
    const text = await file.text();

    if (!text.includes("promotion_code")) {
      throw new Error("Use CSV or XLSX for workbook inspection before upload.");
    }

    const document = new DOMParser().parseFromString(text, "application/xml");
    return Array.from(document.querySelectorAll("Row")).map((row) =>
      Array.from(row.querySelectorAll("Cell Data")).map(
        (cell) => cell.textContent || "",
      ),
    );
  }

  throw new Error("Upload a CSV, XLS, or XLSX workbook.");
}

async function validatePromotionWorkbookFile(
  file,
  promoId,
  systemBrands,
  promoters,
  agencyLabel = "this promotion",
) {
  const fileNameError = validatePromotionUploadFileName(file);

  if (fileNameError) {
    return [fileNameError];
  }

  const fileSizeError = validateFileSize(file, "Promotion Management file");

  if (fileSizeError) {
    return [fileSizeError];
  }

  const extension = getFileExtension(file.name);

  if (!["csv", "xls", "xlsx"].includes(extension)) {
    return ["Upload a CSV, XLS, or XLSX workbook."];
  }

  if (!systemBrands.length) {
    return ["Unable to validate brands because no system brands were loaded."];
  }

  if (!promoters.length) {
    return [`Unable to validate promoters because no promoters were loaded for ${agencyLabel}.`];
  }

  try {
    const rows = await parsePromotionWorkbookRows(file);
    return validateWorkbookRows(rows, promoId, systemBrands, promoters, agencyLabel);
  } catch (error) {
    return [error?.message || "Unable to inspect the workbook."];
  }
}

function getZipLeafName(fileName) {
  return String(fileName || "").split("/").filter(Boolean).pop() || "";
}

function isMacOsMetadataEntry(fileName) {
  const normalizedName = String(fileName || "");
  const leafName = getZipLeafName(normalizedName);

  return (
    normalizedName.startsWith("__MACOSX/") ||
    leafName === ".DS_Store" ||
    leafName.startsWith("._")
  );
}

function hasValidImageSignature(bytes, extension) {
  if (!bytes?.length) {
    return false;
  }

  if (extension === "png") {
    return (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47
    );
  }

  if (extension === "jpg" || extension === "jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8;
  }

  return false;
}

function getImageMimeType(extension) {
  return extension === "jpg" ? "image/jpeg" : `image/${extension}`;
}

function loadImageElement(blob) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(blob);

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Unable to read image."));
    };
    image.src = url;
  });
}

async function decodeQrImage(bytes, extension) {
  const blob = new Blob([bytes], { type: getImageMimeType(extension) });
  const image =
    typeof createImageBitmap === "function"
      ? await createImageBitmap(blob)
      : await loadImageElement(blob);
  const canvas = document.createElement("canvas");
  const width = image.width;
  const height = image.height;

  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context || !width || !height) {
    image.close?.();
    return null;
  }

  context.drawImage(image, 0, 0, width, height);
  image.close?.();

  const imageData = context.getImageData(0, 0, width, height);
  const qrCode = jsQR(imageData.data, width, height);

  return qrCode?.data || null;
}

async function validatePromotionQrZipFile(file) {
  const errors = [];
  const qrCodes = new Set();
  const qrReferences = new Set();
  const decodedQrCodes = new Set();

  if (!file) {
    return { errors: ["Choose the QR images zip file."], qrCodes: [], qrReferences: [] };
  }

  if (getFileExtension(file.name) !== "zip") {
    return { errors: ["Upload the QR images as a .zip file."], qrCodes: [], qrReferences: [] };
  }

  const fileSizeError = validateFileSize(file, "QR zip file");

  if (fileSizeError) {
    return { errors: [fileSizeError], qrCodes: [], qrReferences: [] };
  }

  try {
    const entries = await readZipEntries(file);
    const qrCodeNames = new Set();
    let imageCount = 0;

    for (const entry of entries) {
      if (entry.isDirectory) {
        continue;
      }

      const leafName = getZipLeafName(entry.name);
      const extension = getFileExtension(leafName);
      const codeName = getFileBaseName(leafName);

      if (isMacOsMetadataEntry(entry.name)) {
        continue;
      }

      if (!PROMOTION_QR_IMAGE_EXTENSIONS.includes(extension)) {
        errors.push(`${entry.name} must be a PNG or JPG image.`);
        continue;
      }

      imageCount += 1;

      if (!codeName) {
        errors.push(`${entry.name} must be named after its QR code.`);
      } else if (!/^[A-Za-z0-9_-]+$/.test(codeName)) {
        errors.push(`${entry.name} should use only letters, numbers, hyphens, or underscores before the extension.`);
      }

      if (qrCodeNames.has(codeName.toLowerCase())) {
        errors.push(`${entry.name} duplicates another QR code filename.`);
      }
      qrCodeNames.add(codeName.toLowerCase());
      qrCodes.add(codeName.toLowerCase());
      qrReferences.add(leafName);

      if (!entry.uncompressedSize || !entry.bytes.length) {
        errors.push(`${entry.name} is empty.`);
        continue;
      }

      if (!hasValidImageSignature(entry.bytes, extension)) {
        errors.push(`${entry.name} does not match its image type.`);
        continue;
      }

      try {
        const decodedValue = await decodeQrImage(entry.bytes, extension);

        if (!decodedValue) {
          errors.push(`${entry.name} is not readable as a QR code.`);
          continue;
        }

        const normalizedDecodedValue = decodedValue.trim().toLowerCase();

        if (decodedQrCodes.has(normalizedDecodedValue)) {
          errors.push(`${entry.name} duplicates another readable QR code.`);
        }
        decodedQrCodes.add(normalizedDecodedValue);
        qrCodes.add(normalizedDecodedValue);
      } catch {
        errors.push(`${entry.name} could not be decoded as an image.`);
      }
    }

    if (!entries.length || imageCount === 0) {
      errors.push("The zip must contain at least one PNG or JPG QR image.");
    }

    return {
      errors,
      qrCodes: Array.from(qrCodes),
      qrReferences: Array.from(qrReferences),
    };
  } catch (error) {
    return {
      errors: [error?.message || "Unable to inspect the QR zip file."],
      qrCodes: [],
      qrReferences: [],
    };
  }
}

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes)) {
    return "";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getValidationIssues(errors) {
  return Array.isArray(errors) ? errors.filter(Boolean) : errors ? [errors] : [];
}

function getQrValidationSummary(errors) {
  const issues = getValidationIssues(errors);

  if (!issues.length) {
    return null;
  }

  const duplicateCount = issues.filter((issue) =>
    String(issue).toLowerCase().includes("duplicate"),
  ).length;
  const unreadableCount = issues.filter((issue) =>
    String(issue).toLowerCase().includes("readable") ||
    String(issue).toLowerCase().includes("valid qr"),
  ).length;

  return {
    duplicateCount,
    issueCount: issues.length,
    issues,
    unreadableCount,
  };
}

function getWorkbookValidationSummary(errors) {
  const issues = getValidationIssues(errors);

  if (!issues.length) {
    return null;
  }

  const qrIssueCount = issues.filter((issue) =>
    String(issue).toLowerCase().includes("qr"),
  ).length;
  const promoterIssueCount = issues.filter((issue) =>
    String(issue).toLowerCase().includes("promoter"),
  ).length;
  const brandIssueCount = issues.filter((issue) =>
    String(issue).toLowerCase().includes("brand"),
  ).length;

  return {
    brandIssueCount,
    issueCount: issues.length,
    issues,
    promoterIssueCount,
    qrIssueCount,
  };
}

function mapBackendWorkbookErrors(error) {
  const details = error?.details || {};
  const backendErrors = Array.isArray(details.errors) ? details.errors : [];

  if (!backendErrors.length) {
    return [];
  }

  return backendErrors.map((backendError, index) => {
    const row = backendError?.row ? `Row ${backendError.row}` : `Issue ${index + 1}`;
    const promoterId =
      backendError?.promoter_id || backendError?.promoter_code || "";
    const brand = backendError?.brand || "";
    const message =
      backendError?.error ||
      backendError?.reason ||
      backendError?.message ||
      "Backend validation failed.";
    const context = [promoterId, brand].filter(Boolean).join(" / ");

    return context ? `${row}: ${context} - ${message}` : `${row}: ${message}`;
  });
}

function mapBackendQrUploadErrors(error) {
  const details = error?.details || {};
  const validationResults = Array.isArray(details.validation_results)
    ? details.validation_results
    : Array.isArray(details.results)
      ? details.results
      : [];
  const summary = details.summary || {};
  const issues = [];

  if (details.message) {
    issues.push(details.message);
  } else if (error?.message) {
    issues.push(error.message);
  }

  if (
    summary.total !== undefined ||
    summary.ready_for_upload !== undefined ||
    summary.failed !== undefined ||
    summary.duplicates !== undefined
  ) {
    issues.push(
      `Summary: ${summary.ready_for_upload ?? 0} ready to upload, ${summary.duplicates ?? 0} duplicates, ${summary.failed ?? 0} failed out of ${summary.total ?? validationResults.length}.`,
    );
  }

  validationResults.forEach((result, index) => {
    const filename = result?.filename || `File ${index + 1}`;
    const status = result?.status ? ` ${result.status}` : "";
    const reason = result?.reason || result?.warning || result?.message;
    const renamedName = result?.renamed_filename
      ? ` (${result.renamed_filename})`
      : "";

    issues.push(
      reason
        ? `${filename}${renamedName}:${status} - ${reason}`
        : `${filename}${renamedName}:${status || " validation issue"}`,
    );
  });

  return issues.filter(Boolean);
}

function validateSingleAssignmentFields({
  agencyLabel = "this promotion",
  brandName,
  promoterCode,
  qrFile,
  qrFileRequired = false,
  systemBrands = [],
  promoters = [],
}) {
  const errors = [];

  if (!promoterCode) {
    errors.push("Promoter Code is required.");
  } else if (promoterCode.length > 5) {
    errors.push("Promoter Code cannot be more than 5 characters.");
  }

  if (
    promoterCode &&
    !promoters.some((promoter) =>
      [promoter.promoterId, promoter.promoterCode]
        .filter(Boolean)
        .map(normalizePromoterCode)
        .includes(normalizePromoterCode(promoterCode)),
    )
  ) {
    errors.push(`Promoter ${promoterCode} does not exist in ${agencyLabel}.`);
  }

  if (!brandName) {
    errors.push("Brand is required.");
  } else if (
    !systemBrands.some((brand) =>
      normalizeExactBrandName(brand.name) === normalizeExactBrandName(brandName),
    )
  ) {
    const suggestion = getBrandSuggestion(brandName, systemBrands);
    errors.push(
      suggestion
        ? `Brand ${brandName} does not exist. Did you mean ${suggestion}?`
        : `Brand ${brandName} does not exist.`,
    );
  }

  if (qrFileRequired && !qrFile) {
    errors.push("QR Image is required.");
  }

  if (qrFile) {
    const imageError = validateImageUpload(qrFile, {
      allowedExtensions: ["png", "jpg", "jpeg"],
      allowedMimeTypes: ["image/png", "image/jpeg"],
      fileLabel: "QR Image",
    });

    if (imageError) {
      errors.push(imageError);
    }
  }

  return errors;
}

function PromotionFormModal({
  adminAgency,
  agencies = [],
  canChooseAgency = false,
  currentStatus = "",
  form,
  formError,
  isLoadingAgencies = false,
  isOpen,
  mode,
  onClose,
  isSubmitting = false,
  onSubmit,
  setForm,
  submitLabel,
}) {
  const statusOptions = PROMOTION_STATUS_OPTIONS.filter(
    (option) => option.value !== currentStatus,
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      contentClassName="modal-content promotion-modal"
    >
      <div className="modal-header promoter-edit-header">
        <div>
          <p className="modal-eyebrow">Promotion</p>
          <h2>{mode === "create" ? "Create Promotion" : "Edit Promotion"}</h2>
        </div>
        <button
          type="button"
          className="close-modal"
          aria-label="Close promotion modal"
          onClick={onClose}
        >
          &times;
        </button>
      </div>

      <form className="promotion-form" onSubmit={onSubmit} noValidate>
        <TextInput
          id="promotionName"
          label="Promotion Name"
          type="text"
          value={form.name}
          onChange={(event) =>
            setForm((currentForm) => ({
              ...currentForm,
              name: event.target.value,
            }))
          }
          placeholder="Enter a name for this promotion"
          required
        />

        <TextArea
          id="promotionDescription"
          label="Description"
          value={form.description}
          onChange={(event) =>
            setForm((currentForm) => ({
              ...currentForm,
              description: event.target.value,
            }))
          }
          placeholder="What this promotion covers"
          rows={4}
        />

        {canChooseAgency ? (
          <SelectInput
            id="promotionAgency"
            label="Agency"
            value={form.agency}
            onChange={(event) =>
              setForm((currentForm) => ({
                ...currentForm,
                agency: event.target.value,
              }))
            }
            required
            disabled={isSubmitting || isLoadingAgencies || mode === "edit"}
          >
            <option value="">
              {isLoadingAgencies ? "Loading agencies..." : "Select agency"}
            </option>
            {agencies
              .filter((agency) => mode === "edit" || agency.isActive)
              .map((agency) => (
                <option key={agency.id} value={agency.id}>
                  {agency.name}
                </option>
              ))}
          </SelectInput>
        ) : (
          <TextInput
            id="promotionAgency"
            label="Agency"
            value={getAgencyLabel(adminAgency)}
            disabled
            readOnly
          />
        )}

        <div className="promotion-date-grid">
          <DateInput
            id="promotionStartDate"
            label="Start Date"
            value={form.startDate}
            onChange={(event) =>
              setForm((currentForm) => ({
                ...currentForm,
                startDate: event.target.value,
              }))
            }
            required
          />

          <DateInput
            id="promotionEndDate"
            label="End Date"
            value={form.endDate}
            onChange={(event) =>
              setForm((currentForm) => ({
                ...currentForm,
                endDate: event.target.value,
              }))
            }
            required
          />
        </div>

        {mode === "edit" ? (
          <SelectInput
            id="promotionStatus"
            label="Change Status"
            value={form.status}
            onChange={(event) =>
              setForm((currentForm) => ({
                ...currentForm,
                status: event.target.value,
              }))
            }
          >
            <option value="">Keep current status</option>
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectInput>
        ) : null}

        <FormErrorSummary errors={formError} />

        <div className="brand-admin-form-actions">
          <Button
            type="button"
            variant="secondary"
            className="brand-admin-secondary-btn"
            disabled={isSubmitting}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="brand-admin-primary-btn"
            disabled={isSubmitting}
          >
            {submitLabel || (mode === "create" ? "Create Promotion" : "Save Changes")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function PromotionsListView() {
  const authUser = useAuthStore((state) => state.user);
  const adminAgencyId = getAgencyId(authUser);
  const canChooseAgency = adminCanSelectAgency(authUser);
  const { data: agencies = [], isLoading: isLoadingAgencies } =
    useAgencies(canChooseAgency);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editingPromotion, setEditingPromotion] = useState(null);
  const [form, setForm] = useState(EMPTY_PROMOTION_FORM);
  const [formError, setFormError] = useState("");
  const {
    data: promotions = [],
    isLoading,
    isError,
    error,
  } = usePromotions();
  const { mutateAsync: createPromotion, isPending: isCreatingPromotion } =
    useCreatePromotion();
  const { mutateAsync: updatePromotion, isPending: isUpdatingPromotion } =
    useUpdatePromotion();
  const isSavingPromotion = isCreatingPromotion || isUpdatingPromotion;

  const scopedPromotions = useMemo(
    () => scopeRecordsByAgency(promotions, authUser),
    [authUser, promotions],
  );
  const sortedPromotions = useMemo(
    () => sortPromotions(scopedPromotions),
    [scopedPromotions],
  );

  const filteredPromotions = useMemo(() => {
    const normalizedSearchTerm = searchTerm.trim().toLowerCase();

    return sortedPromotions.filter((promotion) => {
      const promotionState = getPromotionState(promotion);
      const normalizedStatus = promotionState.label.toLowerCase();
      const matchesStatus =
        statusFilter === "all" || normalizedStatus === statusFilter;

      if (!matchesStatus) {
        return false;
      }

      if (!normalizedSearchTerm) {
        return true;
      }

      return [
        promotion.name,
        promotionState.label,
        getPromotionCode(promotion),
        promotion.agency,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearchTerm);
    });
  }, [searchTerm, sortedPromotions, statusFilter]);
  const openCreateModal = () => {
    setEditingPromotion({ mode: "create" });
    setForm({
      ...EMPTY_PROMOTION_FORM,
      agency: canChooseAgency ? "" : adminAgencyId,
    });
    setFormError("");
  };

  const openEditModal = (promotion) => {
    setEditingPromotion(promotion);
    setForm({
      name: promotion.name,
      description: promotion.description || "",
      startDate: promotion.startDate,
      endDate: promotion.endDate,
      status: "",
      agency: promotion.agencyId || adminAgencyId,
    });
    setFormError("");
  };

  const closeModal = () => {
    setEditingPromotion(null);
    setForm(EMPTY_PROMOTION_FORM);
    setFormError("");
  };

  const savePromotion = async (event) => {
    event.preventDefault();

    if (isSavingPromotion) {
      return;
    }

    setFormError("");

    const name = form.name.trim();
    const validationErrors = [];
    const isCreating = editingPromotion?.mode === "create";
    const nextStatus = isCreating
      ? deriveCreatePromotionStatus(form.startDate, form.endDate)
      : form.status || editingPromotion.status;
    const isActive = nextStatus === "active";
    const selectedPromotionAgencyId = canChooseAgency
      ? form.agency
      : adminAgencyId;
    const isDeactivatingPromotion =
      !isCreating && ["inactive", "expired"].includes(form.status);

    if (!name) {
      validationErrors.push("Promotion name is required.");
    }

    if (!selectedPromotionAgencyId) {
      validationErrors.push("Agency is required.");
    }

    if (!isDeactivatingPromotion) {
      if (!form.startDate) {
        validationErrors.push("Start date is required.");
      }

      if (!form.endDate) {
        validationErrors.push("End date is required.");
      }

      if (form.startDate && form.endDate && form.startDate > form.endDate) {
        validationErrors.push("End date must be after the start date.");
      }
    }

    const targetPromotion = {
      id: isCreating ? "__new_promotion__" : editingPromotion.id,
      endDate: form.endDate,
      isActive,
      name,
      startDate: form.startDate,
      status: nextStatus,
      agencyId: selectedPromotionAgencyId,
    };
    const conflictingPromotion = findPromotionScheduleConflict(
      targetPromotion,
      promotions,
    );

    if (!isDeactivatingPromotion && conflictingPromotion) {
      const conflictState = getPromotionState(conflictingPromotion);
      validationErrors.push(
        `${conflictingPromotion.name} already reserves ${formatDate(conflictingPromotion.startDate)} to ${formatDate(conflictingPromotion.endDate)} as ${conflictState.label.toLowerCase()}. Adjust that promotion's dates or make it inactive before saving this promotion window.`,
      );
    }

    if (validationErrors.length) {
      setFormError(validationErrors);
      return;
    }

    try {
      if (isCreating) {
        await createPromotion({
          name,
          description: form.description,
          startDate: form.startDate,
          endDate: form.endDate,
          agencyId: selectedPromotionAgencyId,
        });
      } else {
        const updatePayload = {
          id: editingPromotion.id,
          name,
          description: form.description,
        };

        if (!isDeactivatingPromotion) {
          updatePayload.startDate = form.startDate;
          updatePayload.endDate = form.endDate;
        }

        if (form.status) {
          updatePayload.status = form.status;
          updatePayload.isActive = isActive;
        }

        await updatePromotion(updatePayload);
      }

      await Swal.fire({
        icon: "success",
        title: isCreating ? "Promotion Created" : "Promotion Updated",
        text: `${name} has been saved.`,
        confirmButtonColor: "#22c55e",
      });

      closeModal();
    } catch (submitError) {
      await Swal.fire({
        icon: "error",
        title: "Unable to Save Promotion",
        text: submitError?.message || "Something went wrong.",
        confirmButtonColor: "#d33",
      });
    }
  };

  return (
    <AppLayout activeNav="promotions">
      <div className="main-card promotions-card">
        <div className="card-header promotions-header">
          <div>
            <p className="brands-admin-eyebrow">Promotion Control</p>
            <h2>Promotions</h2>
            <p>
              Define promotion windows first, then manage the promoter-brand QR
              rows inside each promotion.
            </p>
          </div>
          <button
            type="button"
            className="brand-admin-primary-btn"
            disabled={isSavingPromotion}
            onClick={openCreateModal}
          >
            Create Promotion
          </button>
        </div>

        <div className="brands-admin-toolbar">
          <div className="promotions-filter-controls">
            <SearchBar
              ariaLabel="Search promotions"
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Search promotions"
            />
            <SelectInput
              id="promotionStatusFilter"
              label="Status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              {PROMOTION_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectInput>
          </div>
          <span className="brands-admin-count">
            {filteredPromotions.length} of {scopedPromotions.length} promotions
          </span>
        </div>

        <DataTable
          columns={[
            {
              header: "Code",
              key: "code",
              render: (promotion) => (
                <span className="promotion-code-pill">
                  {getPromotionCode(promotion)}
                </span>
              ),
            },
            {
              header: "Promotion",
              key: "promotion",
              render: (promotion) => (
                <div className="promotion-name-cell">
                  <strong>{promotion.name}</strong>
                  <span>Updated {formatDate(promotion.updatedAt?.slice(0, 10))}</span>
                </div>
              ),
            },
            {
              header: "Duration",
              key: "duration",
              render: (promotion) =>
                `${formatDate(promotion.startDate)} - ${formatDate(promotion.endDate)}`,
            },
            ...(canChooseAgency
              ? [
                  {
                    header: "Agency",
                    key: "agency",
                    render: (promotion) => getAgencyLabel(promotion),
                  },
                ]
              : []),
            {
              header: "Status",
              key: "status",
              render: (promotion) => {
                const promotionState = getPromotionState(promotion);

                return (
                  <span className={`promotion-status ${promotionState.className}`}>
                    {promotionState.label}
                  </span>
                );
              },
            },
            {
              cellClassName: "actions-column",
              header: "Actions",
              headerClassName: "actions-column",
              key: "actions",
              render: (promotion) => (
                <div className="brand-admin-actions">
                  {canManagePromotion(promotion) ? (
                    <Link to={`/promotions/${promotion.id}`}>Manage</Link>
                  ) : (
                    <button
                      type="button"
                      className="is-disabled"
                      disabled
                      title="Only active and scheduled promotions can be managed."
                    >
                      Manage
                    </button>
                  )}
                  <button type="button" onClick={() => openEditModal(promotion)}>
                    Edit
                  </button>
                </div>
              ),
            },
          ]}
          dependencies={[searchTerm, scopedPromotions.length, statusFilter]}
          emptyMessage="No promotions created yet."
          error={error}
          errorMessage="Unable to load promotions right now."
          getRowKey={(promotion) => promotion.id}
          isError={isError}
          isLoading={isLoading}
          items={filteredPromotions}
          loadingMessage="Loading promotions..."
          tableClassName="data-table promotions-table"
        />
      </div>

      <PromotionFormModal
        adminAgency={authUser}
        agencies={agencies}
        canChooseAgency={canChooseAgency}
        currentStatus={editingPromotion?.status || ""}
        form={form}
        formError={formError}
        isOpen={Boolean(editingPromotion)}
        mode={editingPromotion?.mode === "create" ? "create" : "edit"}
        onClose={closeModal}
        isSubmitting={isSavingPromotion}
        isLoadingAgencies={isLoadingAgencies}
        onSubmit={savePromotion}
        setForm={setForm}
        submitLabel={
          isSavingPromotion
            ? editingPromotion?.mode === "create"
              ? "Creating Promotion..."
              : "Saving Changes..."
            : undefined
        }
      />
    </AppLayout>
  );
}

function UploadedPromoterBrandsTable({
  isError,
  isLoading,
  promotion,
  promotionBrands,
  promotionBrandsError,
  promoId,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const sortedPromotionBrands = useMemo(
    () =>
      [...promotionBrands].sort((firstBrand, secondBrand) => {
        const promoterCompare = String(firstBrand.promoterId || "").localeCompare(
          String(secondBrand.promoterId || ""),
          undefined,
          { numeric: true, sensitivity: "base" },
        );

        if (promoterCompare !== 0) {
          return promoterCompare;
        }

        const brandCompare = String(firstBrand.brandName || "").localeCompare(
          String(secondBrand.brandName || ""),
          undefined,
          { numeric: true, sensitivity: "base" },
        );

        if (brandCompare !== 0) {
          return brandCompare;
        }

        const lastModifiedCompare = String(
          firstBrand.lastModified || firstBrand.createdAt || "",
        ).localeCompare(
          String(secondBrand.lastModified || secondBrand.createdAt || ""),
        );

        if (lastModifiedCompare !== 0) {
          return lastModifiedCompare;
        }

        return String(firstBrand.id || "").localeCompare(String(secondBrand.id || ""));
    }),
    [promotionBrands],
  );
  const filteredPromotionBrands = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    if (!normalizedSearch) {
      return sortedPromotionBrands;
    }

    return sortedPromotionBrands.filter((brand) =>
      [
        brand.promoterId,
        brand.brandName,
        brand.promotionName,
        brand.qrPath,
        normalizeQrReference(brand.qrPath),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedSearch)),
    );
  }, [searchTerm, sortedPromotionBrands]);

  return (
    <section className="promotion-assignment-panel current-assignments-panel">
      <div className="promotion-assignment-panel-header">
        <div className="current-assignments-title">
          <div className="current-assignments-title-row">
            <h3>Current Assignments</h3>
            <span className="current-assignments-count">
              {promotionBrands.length} assignments
            </span>
          </div>
          <span className="current-assignments-promotion-name">
            {promotion.name || "Selected promotion"}
          </span>
        </div>
        <SearchBar
          ariaLabel="Search assignments"
          onChange={setSearchTerm}
          placeholder="Search assignments..."
          value={searchTerm}
        />
      </div>

      <DataTable
        columns={[
          {
            header: "Promoter",
            key: "promoter",
            render: (brand) => (
              <span className="promotion-code-pill">
                {brand.promoterId || "--"}
              </span>
            ),
          },
          {
            header: "Brand",
            key: "brand",
            render: (brand) => (
              <div className="brand-admin-name-cell">
                <span className="brand-admin-logo">
                  {brand.brandImageUrl ? (
                    <img src={brand.brandImageUrl} alt="" />
                  ) : (
                    brand.brandName.slice(0, 1).toUpperCase() || "B"
                  )}
                </span>
                <div>
                  <strong>{brand.brandName || "--"}</strong>
                  <span>{brand.promotionName || promotion.name}</span>
                </div>
              </div>
            ),
          },
          {
            header: "QR Code",
            key: "qrCode",
            render: (brand) => {
              const qrName = getQrDisplayName(
                brand.qrPath,
                normalizeQrReference(brand.qrPath) || "QR code",
              );

              return brand.qrPath ? (
                <div className="assignment-qr-cell">
                  <span>{qrName}</span>
                  <a
                    className="promotion-brand-qr-link"
                    href={brand.qrPath}
                    target="_blank"
                    rel="noreferrer"
                    title={`Open ${qrName}`}
                  >
                    View {qrName}
                  </a>
                </div>
              ) : (
                "--"
              );
            },
          },
          {
            header: "Last Modified",
            key: "lastModified",
            render: (brand) =>
              formatDate((brand.lastModified || brand.createdAt)?.slice(0, 10)),
          },
        ]}
        dependencies={[promoId, searchTerm, sortedPromotionBrands.length]}
        emptyMessage={
          searchTerm
            ? "No assignments match this search."
            : "No uploaded promoter-brand rows yet."
        }
        error={promotionBrandsError}
        errorMessage="Unable to load uploaded brands."
        getRowKey={(brand) => brand.id}
        isError={isError}
        isLoading={isLoading}
        items={filteredPromotionBrands}
        loadingMessage="Loading uploaded brands..."
        tableClassName="data-table promotion-brands-table"
        wrapperClassName="table-outer-border promotion-brands-table-wrap"
      />
    </section>
  );
}

function PromotionManagementView({
  isActivePromotionRoute = false,
  isPromotionsError = false,
  isPromotionsLoading = false,
  promotions,
  promotionsError,
}) {
  const { promotionId } = useParams();
  const promotion = isActivePromotionRoute
    ? promotions.find(isCurrentlyActivePromotion)
    : promotions.find((currentPromotion) =>
        hasSamePromotionId(currentPromotion.id, promotionId),
      );
  const qrZipInputRef = useRef(null);
  const uploadInputRef = useRef(null);
  const singleAssignmentQrInputRef = useRef(null);
  const editAssignmentQrInputRef = useRef(null);
  const [qrZipFile, setQrZipFile] = useState(null);
  const [qrZipValidation, setQrZipValidation] = useState({
    error: "",
    payload: null,
    status: "idle",
  });
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadValidation, setUploadValidation] = useState({
    error: "",
    payload: null,
    status: "idle",
  });
  const [dragTarget, setDragTarget] = useState(null);
  const [activeAssignmentAction, setActiveAssignmentAction] = useState("qr");
  const [singleAssignmentForm, setSingleAssignmentForm] = useState({
    promoterCode: "",
    brand: "",
    qrFile: null,
  });
  const [singleAssignmentErrors, setSingleAssignmentErrors] = useState([]);
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [editAssignmentForm, setEditAssignmentForm] = useState({
    promoterCode: "",
    brand: "",
    qrFile: null,
  });
  const [editAssignmentErrors, setEditAssignmentErrors] = useState([]);
  const [deletingAssignmentId, setDeletingAssignmentId] = useState(null);
  const { mutateAsync: uploadQrCodesBulk, isPending: isUploadingQrCodes } =
    useUploadPromotionQrCodesBulk();
  const {
    mutateAsync: importBrandsCategory,
    isPending: isUploadingAssignments,
  } = useImportBrandsCategory();
  const {
    mutateAsync: createPromoterBrand,
    isPending: isCreatingPromoterBrand,
  } = useCreatePromoterBrand();
  const {
    mutateAsync: updatePromoterBrand,
    isPending: isUpdatingPromoterBrand,
  } = useUpdatePromoterBrand();
  const {
    mutateAsync: deletePromoterBrand,
    isPending: isDeletingPromoterBrand,
  } = useDeletePromoterBrand();
  const {
    data: systemBrands = [],
    isLoading: isLoadingSystemBrands,
    isError: isSystemBrandsError,
  } = useSystemBrands();
  const {
    data: promoters = [],
    isLoading: isLoadingPromoters,
    isError: isPromotersError,
  } = usePromoters();
  const scopedPromoters = useMemo(
    () =>
      promoters.filter((promoter) => promoter.agencyId === promotion?.agencyId),
    [promoters, promotion?.agencyId],
  );
  const promoId = getPromotionCode(promotion);
  const {
    data: promotionBrands = [],
    isLoading: isLoadingPromotionBrands,
    isError: isPromotionBrandsError,
    error: promotionBrandsError,
    refetch: refetchPromotionBrands,
  } = usePromotionBrands(promoId, Boolean(promotion));
  if (!promotion && isPromotionsLoading) {
    return (
      <AppLayout activeNav={isActivePromotionRoute ? "active-promotion" : "promotions"}>
        <div className="main-card promotions-card">
          <div className="brands-admin-state">
            Loading promotion...
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!promotion && isPromotionsError) {
    return (
      <AppLayout activeNav={isActivePromotionRoute ? "active-promotion" : "promotions"}>
        <div className="main-card promotions-card">
          <div className="brands-admin-state" role="alert">
            {promotionsError?.message || "Unable to load promotions."}
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!promotion) {
    return (
      <AppLayout activeNav={isActivePromotionRoute ? "active-promotion" : "promotions"}>
        <div className="main-card promotions-card">
          <div className="brands-admin-state">
            <strong>
              {isActivePromotionRoute ? "No active promotion found." : "Promotion not found."}
            </strong>
            <Link to="/promotions" className="brand-admin-secondary-link">
              Back to Promotions
            </Link>
          </div>
        </div>
      </AppLayout>
    );
  }

  const promotionState = getPromotionState(promotion);
  const isQrZipValid = qrZipValidation.status === "valid";
  const isUploadValid = uploadValidation.status === "valid";

  if (!isActivePromotionRoute && !canManagePromotion(promotion)) {
    return (
      <AppLayout activeNav="promotions">
        <div className="main-card promotions-card">
          <div className="brands-admin-state promotion-management-blocked">
            <strong>{promotion.name} cannot be managed.</strong>
            <span>
              Only active and scheduled promotions can upload QR codes or manage
              promoter-brand rows.
            </span>
            <Link to="/promotions" className="brand-admin-secondary-link">
              Back to Promotions
            </Link>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (isActivePromotionRoute) {
    return (
      <AppLayout activeNav="active-promotion">
        <div className="main-card promotions-card active-promotion-card">
          <UploadedPromoterBrandsTable
            isError={isPromotionBrandsError}
            isLoading={isLoadingPromotionBrands}
            promotion={promotion}
            promotionBrands={promotionBrands}
            promotionBrandsError={promotionBrandsError}
            promoId={promoId}
          />
        </div>
      </AppLayout>
    );
  }

  const prepareQrZipFile = async (selectedFile) => {
    if (!selectedFile) {
      setQrZipFile(null);
      setQrZipValidation({
        error: ["Choose the QR images zip file."],
        payload: null,
        status: "invalid",
      });
      return;
    }

    setQrZipFile(selectedFile);
    setQrZipValidation({
      error: "",
      payload: null,
      status: "validating",
    });

    const validationResult = await validatePromotionQrZipFile(selectedFile);
    const nextQrCodes = validationResult.qrCodes || [];
    const nextQrReferences = validationResult.qrReferences || [];

    setQrZipValidation({
      error: validationResult.errors,
      payload:
        !validationResult.errors.length
          ? {
            file: selectedFile,
            qrCodes: nextQrCodes,
            qrReferences: nextQrReferences,
          }
          : null,
      status: !validationResult.errors.length ? "valid" : "invalid",
    });

    if (
      uploadFile &&
      !isLoadingSystemBrands &&
      !isSystemBrandsError &&
      !isLoadingPromoters &&
      !isPromotersError
    ) {
      const validationErrors = await validatePromotionWorkbookFile(
        uploadFile,
        promoId,
        systemBrands,
        scopedPromoters,
        getAgencyLabel(promotion),
      );

      setUploadValidation({
        error: validationErrors,
        payload: !validationErrors.length ? { file: uploadFile } : null,
        status: !validationErrors.length ? "valid" : "invalid",
      });
    }
  };

  const handleQrZipFileChange = (event) => {
    void prepareQrZipFile(event.target.files?.[0] || null);
  };

  const clearQrZipFile = () => {
    setQrZipFile(null);
    setQrZipValidation({
      error: "",
      payload: null,
      status: "idle",
    });
    if (qrZipInputRef.current) {
      qrZipInputRef.current.value = "";
    }
  };

  const prepareUploadFile = async (selectedFile) => {
    if (!selectedFile) {
      setUploadFile(null);
      setUploadValidation({
        error: ["Choose the Promotion Management file."],
        payload: null,
        status: "invalid",
      });
      return;
    }

    setUploadFile(selectedFile);
    setUploadValidation({
      error: "",
      payload: null,
      status: "validating",
    });

    if (isLoadingSystemBrands) {
      setUploadValidation({
        error: ["Brands are still loading. Try again in a moment."],
        payload: null,
        status: "invalid",
      });
      return;
    }

    if (isSystemBrandsError) {
      setUploadValidation({
        error: ["Unable to validate brands right now. Refresh and try again."],
        payload: null,
        status: "invalid",
      });
      return;
    }

    if (isLoadingPromoters) {
      setUploadValidation({
        error: ["Promoters are still loading. Try again in a moment."],
        payload: null,
        status: "invalid",
      });
      return;
    }

    if (isPromotersError) {
      setUploadValidation({
        error: ["Unable to validate promoters right now. Refresh and try again."],
        payload: null,
        status: "invalid",
      });
      return;
    }

    const validationErrors = await validatePromotionWorkbookFile(
      selectedFile,
      promoId,
      systemBrands,
      scopedPromoters,
      getAgencyLabel(promotion),
    );

    setUploadValidation({
      error: validationErrors,
      payload: !validationErrors.length
        ? {
            file: selectedFile,
          }
        : null,
      status: !validationErrors.length ? "valid" : "invalid",
    });
  };

  const handleUploadFileChange = (event) => {
    void prepareUploadFile(event.target.files?.[0] || null);
  };

  const clearUploadFile = () => {
    setUploadFile(null);
    setUploadValidation({
      error: "",
      payload: null,
      status: "idle",
    });
    if (uploadInputRef.current) {
      uploadInputRef.current.value = "";
    }
  };

  const handleDropzoneKeyDown = (event, inputRef) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    inputRef.current?.click();
  };

  const handleDropzoneDragOver = (event, target) => {
    event.preventDefault();
    setDragTarget(target);
  };

  const handleDropzoneDragLeave = (event, target) => {
    if (event.currentTarget.contains(event.relatedTarget)) {
      return;
    }

    setDragTarget((currentTarget) => (currentTarget === target ? null : currentTarget));
  };

  const handleQrZipDrop = (event) => {
    event.preventDefault();
    setDragTarget(null);
    const selectedFile = event.dataTransfer.files?.[0] || null;
    void prepareQrZipFile(selectedFile);
  };

  const handleWorkbookDrop = (event) => {
    event.preventDefault();
    setDragTarget(null);
    const selectedFile = event.dataTransfer.files?.[0] || null;
    void prepareUploadFile(selectedFile);
  };

  const handlePreparedUpload = async (event) => {
    event.preventDefault();

    if (isUploadingQrCodes) {
      return;
    }

    setQrZipValidation((currentValidation) => ({
      ...currentValidation,
      error: "",
    }));

    if (!isQrZipValid) {
      setQrZipValidation((currentValidation) => ({
        ...currentValidation,
        error: currentValidation.error?.length
          ? currentValidation.error
          : ["Choose the QR images zip file first."],
        status: "invalid",
      }));
      return;
    }

    try {
      await uploadQrCodesBulk({
        file: qrZipValidation.payload.file,
        promotionCode: promoId,
      });

      await Swal.fire({
        icon: "success",
        title: "QR Codes Uploaded",
        text: "QR codes uploaded successfully.",
        confirmButtonColor: "#22c55e",
      });
      setQrZipFile(null);
      setQrZipValidation((currentValidation) => ({
        ...currentValidation,
        error: "",
        payload: currentValidation.payload
          ? {
              ...currentValidation.payload,
              file: null,
            }
          : null,
        status: "uploaded",
      }));
      if (qrZipInputRef.current) {
        qrZipInputRef.current.value = "";
      }
    } catch (uploadError) {
      const backendQrErrors = mapBackendQrUploadErrors(uploadError);

      if (backendQrErrors.length) {
        setQrZipValidation((currentValidation) => ({
          ...currentValidation,
          error: backendQrErrors,
          payload: currentValidation.payload,
          status: "invalid",
        }));
      }

      await Swal.fire({
        icon: "error",
        title: backendQrErrors.length
          ? "QR ZIP Validation Failed"
          : "Unable to Upload QR Codes",
        text: backendQrErrors.length
          ? `${backendQrErrors.length} QR upload issue${
              backendQrErrors.length === 1 ? "" : "s"
            } found. Review the ZIP issues on this page.`
          : uploadError?.message || "Something went wrong.",
        confirmButtonColor: "#d33",
      });
    }
  };

  const handleAssignmentUpload = async () => {
    if (isUploadingAssignments) {
      return;
    }

    setUploadValidation((currentValidation) => ({
      ...currentValidation,
      error: "",
    }));

    if (!isUploadValid) {
      setUploadValidation((currentValidation) => ({
        ...currentValidation,
        error: currentValidation.error?.length
          ? currentValidation.error
          : ["Choose a file named Promotion Management first."],
        status: "invalid",
      }));
      return;
    }

    try {
      const response = await importBrandsCategory({
        file: uploadValidation.payload.file,
      });

      void refetchPromotionBrands();

      await Swal.fire({
        icon: response.summary?.failed > 0 ? "warning" : "success",
        title: "Workbook Import Complete",
        text:  `Workbook uploaded for promotion ${promoId}.`,
        confirmButtonColor: response.summary?.failed > 0 ? "#f59e0b" : "#22c55e",
      });
      clearUploadFile();
    } catch (uploadError) {
      const backendWorkbookErrors = mapBackendWorkbookErrors(uploadError);

      if (backendWorkbookErrors.length) {
        setUploadValidation((currentValidation) => ({
          ...currentValidation,
          error: backendWorkbookErrors,
          payload: currentValidation.payload || (uploadFile ? { file: uploadFile } : null),
          status: "invalid",
        }));
      }

      await Swal.fire({
        icon: "error",
        title: backendWorkbookErrors.length
          ? "Workbook Validation Failed"
          : "Unable to Upload Workbook",
        text: backendWorkbookErrors.length
          ? `${backendWorkbookErrors.length} backend validation issue${
              backendWorkbookErrors.length === 1 ? "" : "s"
            } found. Review the workbook issues on this page.`
          : uploadError?.message || "Something went wrong.",
        confirmButtonColor: "#d33",
      });
    }
  };

  const handleSingleAssignmentCreate = async (event) => {
    event.preventDefault();

    if (isCreatingPromoterBrand) {
      return;
    }

    setSingleAssignmentErrors([]);

    const promoterCode = singleAssignmentForm.promoterCode.trim().toUpperCase();
    const brandName = singleAssignmentForm.brand.trim();
    const errors = validateSingleAssignmentFields({
      agencyLabel: getAgencyLabel(promotion),
      brandName,
      promoterCode,
      qrFile: singleAssignmentForm.qrFile,
      qrFileRequired: true,
      systemBrands,
      promoters: scopedPromoters,
    });

    setSingleAssignmentErrors(errors);

    if (errors.length) {
      return;
    }

    try {
      const createdBrand = await createPromoterBrand({
        promoterId: promoterCode,
        brandName,
        promotionCode: promoId,
        promoType: promotion.name,
        promoFile: singleAssignmentForm.qrFile,
      });

      setSingleAssignmentForm({
        promoterCode: "",
        brand: "",
        qrFile: null,
      });
      if (singleAssignmentQrInputRef.current) {
        singleAssignmentQrInputRef.current.value = "";
      }
      setSingleAssignmentErrors([]);
      void refetchPromotionBrands();

      await Swal.fire({
        icon: "success",
        title: "Assignment Added",
        text:
          createdBrand?.name
            ? `${promoterCode} · ${createdBrand.name} added to this promotion.`
            : "Promoter assignment added successfully.",
        confirmButtonColor: "#22c55e",
      });
    } catch (createError) {
      await Swal.fire({
        icon: "error",
        title: "Unable to Add Assignment",
        text: createError?.message || "Something went wrong.",
        confirmButtonColor: "#d33",
      });
    }
  };

  const openAssignmentEditModal = (assignment) => {
    setEditingAssignment(assignment);
    setEditAssignmentForm({
      promoterCode: String(assignment.promoterId || "").toUpperCase(),
      brand: assignment.brandName || "",
      qrFile: null,
    });
    setEditAssignmentErrors([]);
    if (editAssignmentQrInputRef.current) {
      editAssignmentQrInputRef.current.value = "";
    }
  };

  const closeAssignmentEditModal = () => {
    setEditingAssignment(null);
    setEditAssignmentForm({
      promoterCode: "",
      brand: "",
      qrFile: null,
    });
    setEditAssignmentErrors([]);
    if (editAssignmentQrInputRef.current) {
      editAssignmentQrInputRef.current.value = "";
    }
  };

  const handleAssignmentEditSubmit = async (event) => {
    event.preventDefault();

    if (!editingAssignment || isUpdatingPromoterBrand) {
      return;
    }

    setEditAssignmentErrors([]);

    const promoterCode = editAssignmentForm.promoterCode.trim().toUpperCase();
    const brandName = editAssignmentForm.brand.trim();
    const errors = validateSingleAssignmentFields({
      agencyLabel: getAgencyLabel(promotion),
      brandName,
      promoterCode,
      qrFile: editAssignmentForm.qrFile,
      qrFileRequired: false,
      systemBrands,
      promoters: scopedPromoters,
    });

    setEditAssignmentErrors(errors);

    if (errors.length) {
      return;
    }

    try {
      await updatePromoterBrand({
        id: editingAssignment.id,
        promoterId: promoterCode,
        brandName,
        promotionCode: promoId,
        promoType: promotion.name,
        promoFile: editAssignmentForm.qrFile,
      });

      void refetchPromotionBrands();
      await Swal.fire({
        icon: "success",
        title: "Assignment Updated",
        text: `${promoterCode} · ${brandName} has been updated.`,
        confirmButtonColor: "#22c55e",
      });
      closeAssignmentEditModal();
    } catch (updateError) {
      await Swal.fire({
        icon: "error",
        title: "Unable to Update Assignment",
        text: updateError?.message || "Something went wrong.",
        confirmButtonColor: "#d33",
      });
    }
  };

  const handleAssignmentDelete = async (assignment) => {
    if (!assignment || isDeletingPromoterBrand) {
      return;
    }

    const result = await Swal.fire({
      icon: "warning",
      title: "Delete Assignment?",
      text: `This will remove ${assignment.promoterId || "this promoter"} · ${assignment.brandName || "this brand"} from ${promotion.name}.`,
      showCancelButton: true,
      confirmButtonText: "Delete Assignment",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#d33",
    });

    if (!result.isConfirmed) {
      return;
    }

    setDeletingAssignmentId(assignment.id);

    try {
      await deletePromoterBrand({
        id: assignment.id,
        promoterId: assignment.promoterId || "",
        promotionCode: promoId,
      });

      void refetchPromotionBrands();
      await Swal.fire({
        icon: "success",
        title: "Assignment Deleted",
        text: "The promoter-brand assignment has been removed.",
        confirmButtonColor: "#22c55e",
      });
    } catch (deleteError) {
      await Swal.fire({
        icon: "error",
        title: "Unable to Delete Assignment",
        text: deleteError?.message || "Something went wrong.",
        confirmButtonColor: "#d33",
      });
    } finally {
      setDeletingAssignmentId(null);
    }
  };

  const copyPromotionCode = async () => {
    try {
      await navigator.clipboard.writeText(promoId);
      await Swal.fire({
        icon: "success",
        title: "Promotion Code Copied",
        showConfirmButton: false,
        timer: 1100,
      });
    } catch {
      await Swal.fire({
        icon: "error",
        title: "Unable to Copy Code",
        text: "Copy the promotion code manually.",
        confirmButtonColor: "#d33",
      });
    }
  };

  const copyTextToClipboard = async (text, successTitle = "Copied") => {
    try {
      await navigator.clipboard.writeText(text);
      await Swal.fire({
        icon: "success",
        title: successTitle,
        showConfirmButton: false,
        timer: 1100,
      });
    } catch {
      await Swal.fire({
        icon: "error",
        title: "Unable to Copy",
        text: "Copy it manually.",
        confirmButtonColor: "#d33",
      });
    }
  };

  const qrValidationSummary = getQrValidationSummary(qrZipValidation.error);
  const workbookValidationSummary = getWorkbookValidationSummary(uploadValidation.error);
  const qrReferenceList = qrZipValidation.payload?.qrReferences || [];
  return (
    <AppLayout activeNav={isActivePromotionRoute ? "active-promotion" : "promotions"}>
      <div className="main-card promotions-card promotion-management-card">
        <section className="promotion-assignment-panel assignment-workspace">
          <div className="assignment-hero-card">
            <div className="assignment-hero-copy">
              <div>
                <Link to="/promotions" className="promotion-back-link">
                  Back to Promotions
                </Link>
                {isActivePromotionRoute ? (
                  <span className="assignment-hero-eyebrow">Active Promotion</span>
                ) : null}
                <h3>
                  {isActivePromotionRoute
                    ? promotion.name
                    : "Promoter & Brand Assignment"}
                </h3>
                <p>
                  {isActivePromotionRoute ? (
                    <>
                      Promoter &amp; Brand Assignment · Upload QR codes and manage
                      promoter-brand assignments for this promotion.
                    </>
                  ) : (
                    "Upload QR codes and manage promoter-brand assignments for this promotion."
                  )}
                </p>
              </div>
            </div>
            <div className="assignment-hero-meta">
              <div className="assignment-code-card">
                <span>Promotion Code</span>
                <div>
                  <strong>{promoId}</strong>
                  <button
                    type="button"
                    className="assignment-icon-button"
                    onClick={() => void copyPromotionCode()}
                    aria-label="Copy promotion code"
                  >
                    <CopyIcon />
                  </button>
                </div>
              </div>
              <div className="assignment-promotion-meta">
                <span className={`promotion-status ${promotionState.className}`}>
                  {promotionState.label}
                </span>
                <span className="promotion-status is-agency">
                  {getAgencyLabel(promotion)}
                </span>
                <span>
                  <AssignmentIcon type="calendar" />
                  {formatDate(promotion.startDate)} - {formatDate(promotion.endDate)}
                </span>
              </div>
            </div>
          </div>

          <details className="assignment-instructions" open>
            <summary>
              <span className="assignment-instructions-title">
                <AssignmentIcon type="info" />
                How assignment uploads work
              </span>
              <span className="assignment-chevron" aria-hidden="true">
                <AssignmentIcon type="chevronDown" />
              </span>
            </summary>
            <div>
              <p>
                QR uploads, workbook imports, and single assignments are
                separate actions. The workbook QR column must contain an image
                filename such as <code>35FQ5.png</code>, <code>35FQ5.jpg</code>,
                or <code>35FQ5.jpeg</code>.
              </p>
              <p>
                QR ZIPs should contain PNG or JPG images named after their QR
                reference. Workbooks must include <code>promotion_code</code>,{" "}
                <code>promoter_code</code>, <code>brand</code>, and{" "}
                <code>qr code</code>.
              </p>
            </div>
          </details>

          <div className="assignment-action-switcher" role="tablist" aria-label="Assignment actions">
            {[
              { icon: "qr", label: "QR Codes", value: "qr" },
              { icon: "user", label: "Single Assignment", value: "single" },
              { icon: "upload", label: "Bulk Assignments", value: "bulk" },
            ].map((action) => (
              <button
                key={action.value}
                type="button"
                role="tab"
                aria-selected={activeAssignmentAction === action.value}
                className={activeAssignmentAction === action.value ? "is-active" : ""}
                onClick={() => setActiveAssignmentAction(action.value)}
              >
                <AssignmentIcon type={action.icon} />
                {action.label}
              </button>
            ))}
          </div>

          <div className="assignment-workspace-card">
            {activeAssignmentAction === "qr" ? (
              <form
                className="assignment-action-panel assignment-action-panel--qr"
                onSubmit={handlePreparedUpload}
                noValidate
              >
                <div className="assignment-action-main">
                  <div className="assignment-action-heading">
                    <h4>Upload QR-code ZIP</h4>
                    <p>Upload one ZIP containing the QR images for this promotion.</p>
                  </div>

                  <label
                    className={`promotion-upload-dropzone promotion-upload-dropzone--qr ${
                      dragTarget === "qr" ? "is-dragging" : ""
                    }`.trim()}
                    htmlFor="promotionQrZipUpload"
                    tabIndex={0}
                    role="button"
                    onKeyDown={(event) => handleDropzoneKeyDown(event, qrZipInputRef)}
                    onDragOver={(event) => handleDropzoneDragOver(event, "qr")}
                    onDragLeave={(event) => handleDropzoneDragLeave(event, "qr")}
                    onDrop={handleQrZipDrop}
                  >
                    <input
                      id="promotionQrZipUpload"
                      ref={qrZipInputRef}
                      type="file"
                      accept={PROMOTION_QR_ZIP_ACCEPT}
                      onChange={handleQrZipFileChange}
                    />
                    <span className="assignment-dropzone-icon">
                      <AssignmentIcon type="upload" />
                    </span>
                    <strong>
                      {qrZipFile ? qrZipFile.name : "Drag & drop ZIP file here"}
                    </strong>
                    <small>
                      {qrZipFile
                        ? formatFileSize(qrZipFile.size)
                        : "or click to browse"}
                    </small>
                    <em>ZIP only · max 3MB</em>
                  </label>

                  {qrZipValidation.status === "validating" ? (
                    <p className="promotion-upload-message">
                      Inspecting QR zip contents...
                    </p>
                  ) : null}

                  {isQrZipValid ? (
                    <div className="promotion-upload-ready">
                      <strong>ZIP validated</strong>
                      <span>
                        {qrZipValidation.payload.qrCodes.length} QR{" "}
                        {qrZipValidation.payload.qrCodes.length === 1
                          ? "code"
                          : "codes"}{" "}
                        detected
                      </span>
                    </div>
                  ) : null}

                  {qrValidationSummary ? (
                    <div className="promotion-upload-message promotion-upload-message--error">
                      <strong>ZIP needs attention</strong>
                      <span>{qrValidationSummary.issueCount} issues found</span>
                      {qrValidationSummary.unreadableCount ? (
                        <span>{qrValidationSummary.unreadableCount} unreadable QR codes</span>
                      ) : null}
                      {qrValidationSummary.duplicateCount ? (
                        <span>{qrValidationSummary.duplicateCount} duplicates found</span>
                      ) : null}
                      <details className="assignment-issue-details">
                        <summary>View issues</summary>
                        <FormErrorSummary
                          errors={qrValidationSummary.issues}
                          title="QR zip issues found:"
                        />
                      </details>
                    </div>
                  ) : null}

                  <div className="promotion-upload-actions">
                    {qrZipFile ? (
                      <button
                        type="button"
                        className="brand-admin-secondary-btn"
                        onClick={clearQrZipFile}
                      >
                        Remove File
                      </button>
                    ) : null}
                    <button
                      type="submit"
                      className="brand-admin-primary-btn"
                      disabled={
                        !isQrZipValid ||
                        isUploadingQrCodes ||
                        qrZipValidation.status === "validating"
                      }
                    >
                      {isUploadingQrCodes ? "Uploading..." : "Upload QR ZIP"}
                    </button>
                  </div>
                </div>

                <aside className="qr-reference-panel" aria-live="polite">
                  <div className="qr-reference-panel__header">
                    <div>
                      <h4>QR filenames</h4>
                      <p>
                        Copy these names into the workbook <code>qr code</code>{" "}
                        column.
                      </p>
                    </div>
                    {qrReferenceList.length ? (
                      <button
                        type="button"
                        className="brand-admin-secondary-btn qr-reference-copy-all"
                        onClick={() =>
                          void copyTextToClipboard(
                            qrReferenceList.join("\n"),
                            "QR Filenames Copied",
                          )
                        }
                      >
                        Copy All
                      </button>
                    ) : null}
                  </div>

                  {qrReferenceList.length ? (
                    <div className="qr-reference-list">
                      {qrReferenceList.map((reference) => (
                        <div className="qr-reference-item" key={reference}>
                          <code>{reference}</code>
                          <button
                            type="button"
                            className="qr-reference-copy-btn"
                            aria-label={`Copy ${reference}`}
                            onClick={() =>
                              void copyTextToClipboard(reference, "QR Filename Copied")
                            }
                          >
                            <CopyIcon />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="qr-reference-empty">
                      <strong>No QR filenames detected yet.</strong>
                      <span>
                        Add a valid ZIP file to preview the image filenames here.
                      </span>
                    </div>
                  )}
                </aside>

              </form>
            ) : null}

            {activeAssignmentAction === "bulk" ? (
              <form
                className="assignment-action-panel"
                noValidate
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleAssignmentUpload();
                }}
              >
                <div className="assignment-action-main">
                  <div className="assignment-action-heading">
                    <h4>Upload bulk assignments</h4>
                    <p>Import multiple promoter-brand assignments from a workbook.</p>
                  </div>

                  <button
                    type="button"
                    className="brand-admin-secondary-btn assignment-template-button"
                    onClick={() => downloadPromotionWorkbookTemplate(promoId)}
                  >
                    Download assignment template
                  </button>

                  <label
                    className={`promotion-upload-dropzone promotion-upload-dropzone--workbook ${
                      dragTarget === "workbook" ? "is-dragging" : ""
                    }`.trim()}
                    htmlFor="promotionManagementUpload"
                    tabIndex={0}
                    role="button"
                    onKeyDown={(event) => handleDropzoneKeyDown(event, uploadInputRef)}
                    onDragOver={(event) => handleDropzoneDragOver(event, "workbook")}
                    onDragLeave={(event) => handleDropzoneDragLeave(event, "workbook")}
                    onDrop={handleWorkbookDrop}
                  >
                    <input
                      id="promotionManagementUpload"
                      ref={uploadInputRef}
                      type="file"
                      accept={PROMOTION_UPLOAD_ACCEPT}
                      onChange={handleUploadFileChange}
                    />
                    <span className="assignment-dropzone-icon">
                      <AssignmentIcon type="upload" />
                    </span>
                    <strong>
                      {uploadFile ? uploadFile.name : "Drag & drop workbook here"}
                    </strong>
                    <small>
                      {uploadFile
                        ? formatFileSize(uploadFile.size)
                        : "or click to browse"}
                    </small>
                    <em>CSV, XLS or XLSX · max 3MB</em>
                  </label>

                  {uploadValidation.status === "validating" ? (
                    <p className="promotion-upload-message">
                      Inspecting workbook headers and rows...
                    </p>
                  ) : null}

                  {isUploadValid ? (
                    <div className="promotion-upload-ready">
                      <strong>Workbook ready</strong>
                      <span>{uploadValidation.payload.file.name}</span>
                    </div>
                  ) : null}

                  {workbookValidationSummary ? (
                    <div className="promotion-upload-message promotion-upload-message--error">
                      <strong>Workbook needs attention</strong>
                      <span>{workbookValidationSummary.issueCount} issues found</span>
                      {workbookValidationSummary.qrIssueCount ? (
                        <span>{workbookValidationSummary.qrIssueCount} QR reference issues</span>
                      ) : null}
                      {workbookValidationSummary.promoterIssueCount ? (
                        <span>{workbookValidationSummary.promoterIssueCount} promoter issues</span>
                      ) : null}
                      {workbookValidationSummary.brandIssueCount ? (
                        <span>{workbookValidationSummary.brandIssueCount} brand issues</span>
                      ) : null}
                      <details className="assignment-issue-details">
                        <summary>View affected rows</summary>
                        <FormErrorSummary
                          errors={workbookValidationSummary.issues}
                          title="Workbook issues found:"
                        />
                      </details>
                    </div>
                  ) : null}

                  <div className="promotion-upload-actions">
                    {uploadFile ? (
                      <button
                        type="button"
                        className="brand-admin-secondary-btn"
                        onClick={clearUploadFile}
                      >
                        Remove File
                      </button>
                    ) : null}
                    <button
                      type="submit"
                      className="brand-admin-primary-btn"
                      disabled={!isUploadValid || isUploadingAssignments}
                    >
                      {isUploadingAssignments ? "Uploading..." : "Upload Assignments"}
                    </button>
                  </div>
                </div>

              </form>
            ) : null}

            {activeAssignmentAction === "single" ? (
              <form
                className="assignment-single-panel"
                noValidate
                onSubmit={handleSingleAssignmentCreate}
              >
                <div className="single-assignment-header">
                  <div className="assignment-upload-title">
                    <div>
                      <h4>Add one assignment</h4>
                    </div>
                  </div>
                  <Link to="/promoters" className="brand-admin-secondary-link">
                    View All Promoters
                  </Link>
                </div>

                <div className="single-assignment-grid">
                  <TextInput
                    id="singleAssignmentPromoterCode"
                    label="Promoter Code"
                    value={singleAssignmentForm.promoterCode}
                    onChange={(event) =>
                      setSingleAssignmentForm((currentForm) => ({
                        ...currentForm,
                        promoterCode: event.target.value.toUpperCase(),
                      }))
                    }
                    placeholder="Enter promoter code"
                    maxLength={5}
                    required
                  />

                  <SelectInput
                    id="singleAssignmentBrand"
                    label="Brand"
                    value={singleAssignmentForm.brand}
                    onChange={(event) =>
                      setSingleAssignmentForm((currentForm) => ({
                        ...currentForm,
                        brand: event.target.value,
                      }))
                    }
                    required
                  >
                    <option value="">Select brand</option>
                    {systemBrands.map((brand) => (
                      <option key={brand.id || brand.name} value={brand.name}>
                        {brand.name}
                      </option>
                    ))}
                  </SelectInput>
                </div>

                <FileInput
                  ref={singleAssignmentQrInputRef}
                  id="singleAssignmentQrFile"
                  label="QR Image"
                  accept=".jpg,.jpeg,.png"
                  onChange={(event) =>
                    setSingleAssignmentForm((currentForm) => ({
                      ...currentForm,
                      qrFile: event.target.files?.[0] || null,
                    }))
                  }
                  hint={
                    singleAssignmentForm.qrFile
                      ? `${singleAssignmentForm.qrFile.name} · ${formatFileSize(singleAssignmentForm.qrFile.size)}`
                      : "PNG or JPG, max 3MB"
                  }
                  required
                />

                <FormErrorSummary
                  errors={singleAssignmentErrors}
                  title="Assignment issues found:"
                />

                <div className="promotion-upload-actions">
                  <button
                    type="button"
                    className="brand-admin-secondary-btn"
                    onClick={() => {
                      setSingleAssignmentForm({
                        promoterCode: "",
                        brand: "",
                        qrFile: null,
                      });
                      if (singleAssignmentQrInputRef.current) {
                        singleAssignmentQrInputRef.current.value = "";
                      }
                      setSingleAssignmentErrors([]);
                    }}
                    disabled={isCreatingPromoterBrand}
                  >
                    Clear
                  </button>
                  <button
                    type="submit"
                    className="brand-admin-primary-btn"
                    disabled={isCreatingPromoterBrand}
                  >
                    {isCreatingPromoterBrand ? "Adding..." : "Add Assignment"}
                  </button>
                </div>
              </form>
            ) : null}
          </div>
        </section>

        <UploadedPromoterBrandsTable
          isError={isPromotionBrandsError}
          isLoading={isLoadingPromotionBrands}
          promotion={promotion}
          promotionBrands={promotionBrands}
          promotionBrandsError={promotionBrandsError}
          promoId={promoId}
        />

        <Modal
          isOpen={Boolean(editingAssignment)}
          onClose={closeAssignmentEditModal}
          contentClassName="modal-content promotion-modal"
        >
          <div className="modal-header promoter-edit-header">
            <div>
              <p className="modal-eyebrow">Assignment</p>
              <h2>Edit Assignment</h2>
            </div>
            <button
              type="button"
              className="close-modal"
              aria-label="Close assignment modal"
              onClick={closeAssignmentEditModal}
              disabled={isUpdatingPromoterBrand}
            >
              &times;
            </button>
          </div>

          <form
            className="promotion-form"
            onSubmit={handleAssignmentEditSubmit}
            noValidate
          >
            <div className="single-assignment-grid">
              <TextInput
                id="editAssignmentPromoterCode"
                label="Promoter Code"
                value={editAssignmentForm.promoterCode}
                onChange={(event) =>
                  setEditAssignmentForm((currentForm) => ({
                    ...currentForm,
                    promoterCode: event.target.value.toUpperCase(),
                  }))
                }
                placeholder="Enter promoter code"
                maxLength={5}
                disabled
                required
              />

              <SelectInput
                id="editAssignmentBrand"
                label="Brand"
                value={editAssignmentForm.brand}
                onChange={(event) =>
                  setEditAssignmentForm((currentForm) => ({
                    ...currentForm,
                    brand: event.target.value,
                  }))
                }
                required
              >
                <option value="">Select brand</option>
                {systemBrands.map((brand) => (
                  <option key={brand.id || brand.name} value={brand.name}>
                    {brand.name}
                  </option>
                ))}
              </SelectInput>
            </div>

            {editingAssignment?.qrPath ? (
              <div className="assignment-current-qr">
                <span className="assignment-current-qr__preview" aria-hidden="true">
                  <img
                    src={editingAssignment.qrPath}
                    alt=""
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                  />
                </span>
                <div className="assignment-current-qr__copy">
                  <span>Current QR Code</span>
                  <strong>
                    {getQrDisplayName(
                      editingAssignment.qrPath,
                      normalizeQrReference(editingAssignment.qrPath) || "QR code",
                    )}
                  </strong>
                  <a
                    className="promotion-brand-qr-link"
                    href={editingAssignment.qrPath}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open current QR
                  </a>
                </div>
              </div>
            ) : null}

            <FileInput
              ref={editAssignmentQrInputRef}
              id="editAssignmentQrFile"
              label="Replace QR Image"
              accept=".jpg,.jpeg,.png"
              onChange={(event) =>
                setEditAssignmentForm((currentForm) => ({
                  ...currentForm,
                  qrFile: event.target.files?.[0] || null,
                }))
              }
              hint={
                editAssignmentForm.qrFile
                  ? `${editAssignmentForm.qrFile.name} · ${formatFileSize(editAssignmentForm.qrFile.size)}`
                  : "Optional. PNG or JPG, max 3MB"
              }
            />

            <FormErrorSummary
              errors={editAssignmentErrors}
              title="Assignment issues found:"
            />

            <div className="brand-admin-form-actions">
              <button
                type="button"
                className="brand-admin-secondary-btn"
                onClick={closeAssignmentEditModal}
                disabled={isUpdatingPromoterBrand}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="brand-admin-primary-btn"
                disabled={isUpdatingPromoterBrand}
              >
                {isUpdatingPromoterBrand ? "Saving..." : "Save Assignment"}
              </button>
            </div>
          </form>
        </Modal>
      </div>
    </AppLayout>
  );
}

function ActivePromotionsOverview({
  error,
  isError,
  isLoading,
  promotions,
}) {
  const activePromotions = useMemo(
    () => sortPromotions(promotions.filter(isCurrentlyActivePromotion)),
    [promotions],
  );

  return (
    <AppLayout activeNav="active-promotion">
      <div className="main-card promotions-card">
        <div className="card-header promotions-header">
          <div>
            <p className="brands-admin-eyebrow">Active Promotions</p>
            <h2>Active Promotions by Agency</h2>
            <p>
              Each agency can have one active promotion. Choose one to manage its
              promoter-brand assignments.
            </p>
          </div>
          <span className="brands-admin-count">
            {activePromotions.length} active
          </span>
        </div>

        <DataTable
          columns={[
            {
              header: "Agency",
              key: "agency",
              render: (promotion) => getAgencyLabel(promotion),
            },
            {
              header: "Promotion",
              key: "promotion",
              render: (promotion) => (
                <div className="promotion-name-cell">
                  <strong>{promotion.name}</strong>
                  <span>{getPromotionCode(promotion)}</span>
                </div>
              ),
            },
            {
              header: "Duration",
              key: "duration",
              render: (promotion) =>
                `${formatDate(promotion.startDate)} - ${formatDate(promotion.endDate)}`,
            },
            {
              cellClassName: "actions-column",
              header: "Actions",
              headerClassName: "actions-column",
              key: "actions",
              render: (promotion) => (
                <div className="brand-admin-actions">
                  <Link to={`/promotions/${promotion.id}`}>Manage</Link>
                </div>
              ),
            },
          ]}
          dependencies={[activePromotions.length]}
          emptyMessage="No active promotions found."
          error={error}
          errorMessage="Unable to load active promotions right now."
          getRowKey={(promotion) => promotion.id}
          isError={isError}
          isLoading={isLoading}
          items={activePromotions}
          loadingMessage="Loading active promotions..."
          tableClassName="data-table promotions-table"
        />
      </div>
    </AppLayout>
  );
}

export default function PromotionsPage({ activePromotionOnly = false }) {
  const authUser = useAuthStore((state) => state.user);
  const { promotionId } = useParams();
  const {
    data: promotions = [],
    isLoading: isPromotionsLoading,
    isError: isPromotionsError,
    error: promotionsError,
  } = usePromotions();
  const scopedPromotions = useMemo(
    () => scopeRecordsByAgency(promotions, authUser),
    [authUser, promotions],
  );

  if (activePromotionOnly) {
    const activePromotions = scopedPromotions.filter(isCurrentlyActivePromotion);

    if (activePromotions.length > 1) {
      return (
        <ActivePromotionsOverview
          promotions={scopedPromotions}
          isLoading={isPromotionsLoading}
          isError={isPromotionsError}
          error={promotionsError}
        />
      );
    }

    return (
      <PromotionManagementView
        promotions={scopedPromotions}
        isPromotionsLoading={isPromotionsLoading}
        isPromotionsError={isPromotionsError}
        promotionsError={promotionsError}
        isActivePromotionRoute
      />
    );
  }

  if (promotionId) {
    return (
      <PromotionManagementView
        promotions={scopedPromotions}
        isPromotionsLoading={isPromotionsLoading}
        isPromotionsError={isPromotionsError}
        promotionsError={promotionsError}
      />
    );
  }

  return <PromotionsListView />;
}
