export const MAX_UPLOAD_FILE_SIZE_BYTES = 3 * 1024 * 1024;
export const MAX_UPLOAD_FILE_SIZE_LABEL = "3MB";
const IMAGE_FILE_EXTENSION_PATTERN =
  /\.(avif|bmp|gif|heic|heif|ico|jpe?g|png|svg|tiff?|webp)$/i;

export function validateFileSize(
  file,
  fileLabel = "File",
  maxFileSizeBytes = MAX_UPLOAD_FILE_SIZE_BYTES,
) {
  if (!file || file.size <= maxFileSizeBytes) {
    return null;
  }

  const maxSizeLabel =
    maxFileSizeBytes === MAX_UPLOAD_FILE_SIZE_BYTES
      ? MAX_UPLOAD_FILE_SIZE_LABEL
      : `${Math.round(maxFileSizeBytes / (1024 * 1024))}MB`;

  return `${fileLabel} must be ${maxSizeLabel} or smaller.`;
}

function buildExtensionPattern(extensions) {
  const normalizedExtensions = extensions
    .map((extension) => extension.replace(/^\./, "").trim().toLowerCase())
    .filter(Boolean);

  return new RegExp(`\\.(${normalizedExtensions.join("|")})$`, "i");
}

export function validateImageUpload(file, options = {}) {
  if (!file) {
    return null;
  }

  const {
    allowedMimeTypes,
    allowedExtensions,
    fileLabel = "Image",
    maxFileSizeBytes,
  } = options;

  const hasImageMimeType =
    typeof file.type === "string" && file.type.toLowerCase().startsWith("image/");
  const defaultHasImageExtension =
    typeof file.name === "string" && IMAGE_FILE_EXTENSION_PATTERN.test(file.name);
  const normalizedMimeType = typeof file.type === "string" ? file.type.toLowerCase() : "";
  const normalizedFileName = typeof file.name === "string" ? file.name : "";
  const extensionPattern =
    Array.isArray(allowedExtensions) && allowedExtensions.length > 0
      ? buildExtensionPattern(allowedExtensions)
      : IMAGE_FILE_EXTENSION_PATTERN;
  const hasAllowedExtension = extensionPattern.test(normalizedFileName);
  const hasAllowedMimeType =
    Array.isArray(allowedMimeTypes) && allowedMimeTypes.length > 0
      ? allowedMimeTypes.some((mimeType) => mimeType.toLowerCase() === normalizedMimeType)
      : hasImageMimeType;
  const hasExplicitNonImageMimeType =
    Boolean(normalizedMimeType) && !hasImageMimeType;

  if (Array.isArray(allowedMimeTypes) && allowedMimeTypes.length > 0) {
    if (hasExplicitNonImageMimeType || (!hasAllowedMimeType && !hasAllowedExtension)) {
      const extensionList = allowedExtensions?.join(", ");
      return extensionList
        ? `Only ${extensionList} files are allowed for ${fileLabel.toLowerCase()}.`
        : `Only supported image files are allowed for ${fileLabel.toLowerCase()}.`;
    }
  } else if (hasExplicitNonImageMimeType || (!hasImageMimeType && !defaultHasImageExtension)) {
    return "Only image files are allowed.";
  }

  if (Array.isArray(allowedExtensions) && allowedExtensions.length > 0 && !hasAllowedExtension) {
    return `Only ${allowedExtensions.join(", ")} files are allowed for ${fileLabel.toLowerCase()}.`;
  }

  const fileSizeError = validateFileSize(file, fileLabel, maxFileSizeBytes);

  if (fileSizeError) {
    return fileSizeError;
  }

  return null;
}
