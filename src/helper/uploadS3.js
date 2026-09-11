import { S3Client, PutObjectCommand, CreateMultipartUploadCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand, UploadPartCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import env from "../config/env.js";

const BUCKET_NAME = env.S3_BUCKET;
const REGION = env.S3_REGION;
const signedUrlExpireSeconds = 60 * 30;

const s3Client = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  },
});

const onGeneratePresignURL = async ({ folder = "", userId = "", tempAttachmentId = "", filename = "", mimeType = "" } = {}) => {
  const s3Key = tempAttachmentId 
  ? `${folder}/${tempAttachmentId}_${filename}` 
  : `${folder}/${userId}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key,
    ContentType: mimeType,
  });

  const url = await getSignedUrl(s3Client, command, {
    expiresIn: signedUrlExpireSeconds,
  });

  return { url, fileName: s3Key, s3Key };
};

const onGenerateMultiPartUploadURL = async ({ folder = "", userId = "", tempAttachmentId = "", filename = "", mimeType = "" } = {}) => {
  const s3Key = tempAttachmentId 
  ? `${folder}/${tempAttachmentId}_${filename}` 
  : `${folder}/${userId}`;
  
  const command = new CreateMultipartUploadCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key,
    ContentType: mimeType,
  });

  const res = await s3Client.send(command);
  
  return { uploadId: res.UploadId, s3Key };
};

const onGeneratePartPresignedURL = async ({ s3Key, uploadId, partNumber }) => {
  const command = new UploadPartCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key,
    UploadId: uploadId,
    PartNumber: Number(partNumber),
  });

  const url = await getSignedUrl(s3Client, command, {
    expiresIn: signedUrlExpireSeconds,
  });

  return { url, presignedUrl: url };
};

const onGetURL = async (type, userId = "", tempAttachmentId = "", filename = "") => {
  if (type === "avatar" && !userId) return null;
  if (type !== "avatar" && !filename) return null;

  const folder = type === "avatar" ? "avatars" : "messageFiles";
  
  const s3Key = tempAttachmentId 
  ? `${folder}/${tempAttachmentId}_${filename}` 
  : `${folder}/${userId}`;

  const encodedKey = s3Key.split('/').map(encodeURIComponent).join('/');
  
  const baseUrl = `https://${env.S3_BUCKET}.s3.${env.S3_REGION}.amazonaws.com/${encodedKey}`;
  // Thêm date vào để tránh việc cache data image cũ của user 
  // bởi vì fileName dùng cố định userId nên sẽ không thay đổi khi update avatar
  return type === "avatar" ? `${baseUrl}?v=${Date.now()}` : baseUrl; 
};

const onCompleteMultipart = async ({ uploadId, s3Key, parts }) => {
  try {
    const command = new CompleteMultipartUploadCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts.sort((a, b) => a.PartNumber - b.PartNumber),
      },
    });

    const result = await s3Client.send(command);

    return result;
  } catch (error) {
    console.error("Error completing multipart upload:", error);
    throw error;
  }
};

export const UPLOAD_S3 = { onGeneratePresignURL, onGenerateMultiPartUploadURL, onGeneratePartPresignedURL, onGetURL, onCompleteMultipart };
