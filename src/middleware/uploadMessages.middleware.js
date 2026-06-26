import multer from "multer";

const storage = multer.memoryStorage();

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

const allowedMimeTypes = [
  // images
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",

  // videos
  "video/mp4",
  "video/webm",
  "video/quicktime",

  // documents
  "text/plain",
  "text/csv",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",

  // zip / archives
  "application/zip",
  "application/x-zip-compressed",
  "application/vnd.rar",
  "application/x-rar-compressed",
  "application/x-7z-compressed",

  //audio
  "audio/mpeg",
  "audio/x-wav",
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/mp4",
];

export const uploadMultiFile = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 15,
  },
  fileFilter: (req, file, cb) => {
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error("File không đúng định dạng"));
    }

    cb(null, true);
  },
});
