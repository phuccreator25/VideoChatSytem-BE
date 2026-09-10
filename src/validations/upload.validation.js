// Các định dạng file thực thi / script nguy hiểm bị cấm tuyệt đối
const DISALLOWED_EXTENSIONS = /\.(exe|bat|cmd|sh|php|vbs|scr|dll|iso|jar|msi)$/i;

// Danh sách định dạng ảnh dành riêng cho Upload Avatar
const ALLOWED_AVATAR_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/svg+xml",
];
const ALLOWED_AVATAR_EXTS = /\.(jpg|jpeg|png|webp|gif|bmp|svg)$/i;

const ALLOWED_MESSAGE_MIMES = [
  // Images
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml",
  // Videos
  "video/mp4", "video/webm", "video/quicktime",
  // Documents
  "text/plain", "text/csv", "application/pdf",
  "application/msword", // .doc
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/vnd.ms-excel", // .xls
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.ms-powerpoint", // .ppt
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
  // Archives
  "application/zip", "application/x-zip-compressed", "application/vnd.rar", "application/x-rar-compressed", "application/x-7z-compressed",
  // Audio
  "audio/mpeg", "audio/x-wav", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4", "audio/ogg", "audio/wav"
];

const MAX_MESSAGE_FILE_SIZE = 1 * 1024 * 1024 * 1024; // 1 GB
const MAX_AVATAR_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export const validateUploadFile = (file, type) => {
  const fileName = (file?.fileName || file?.name || "").trim();
  if (!file || !fileName) {
    throw new Error("Thông tin file không hợp lệ");
  }

  const mimeType = (file.mimeType || file.type || "").toLowerCase();
  const fileSize = Number(file.fileSize || file.size || 0);

  if (DISALLOWED_EXTENSIONS.test(fileName)) {
    throw new Error(`File "${fileName}" thuộc định dạng cấm, không thể tải lên`);
  }

  if (fileSize > 0) {
    const maxAllowedSize = type === "avatar" ? MAX_AVATAR_FILE_SIZE : MAX_MESSAGE_FILE_SIZE;
    if (fileSize > maxAllowedSize) {
      const limitText = type === "avatar" ? "5MB" : "1GB";
      throw new Error(`Dung lượng file "${fileName}" vượt quá giới hạn cho phép (${limitText})`);
    }
  }

  if (type === "avatar") {
    if (!ALLOWED_AVATAR_EXTS.test(fileName) || (mimeType && !ALLOWED_AVATAR_MIMES.includes(mimeType))) {
      throw new Error("Ảnh đại diện phải thuộc định dạng hình ảnh (JPG, PNG, WEBP, GIF, SVG)");
    }
  }

  if (type === "message" && mimeType) {
    const isAllowed =
      ALLOWED_MESSAGE_MIMES.includes(mimeType) ||
      mimeType.startsWith("image/") ||
      mimeType.startsWith("video/") ||
      mimeType.startsWith("audio/") ||
      mimeType.startsWith("application/") ||
      mimeType.startsWith("text/");

    if (!isAllowed) {
      throw new Error(`Định dạng file "${fileName}" (${mimeType}) không được hỗ trợ`);
    }
  }
};
