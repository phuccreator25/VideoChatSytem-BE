import { UPLOAD_SERVICE } from "../service/upload.service.js";

const onPresignUrl = async (req, res, next) => {
  try {
    const { files, type } = req.body;
    const userId = req.user.id;

    const response = await UPLOAD_SERVICE.onPresignURL({ files, type, userId });
    return res.status(200).json({ success: true, data: response });
  } catch (error) {
    next(error);
  }
};

const onUpdateStatus = async (req, res, next) => {
  try {
    const { messageId, tempMessageId, successAttachmentIds, failedAttachmentIds } = req.body;

    const response = await UPLOAD_SERVICE.onUpdateStatus({
      messageId,
      tempMessageId,
      successAttachmentIds,
      failedAttachmentIds,
    });
    return res.status(200).json({ success: true, data: response });
  } catch (error) {
    next(error);
  }
};

const onCompleteMultipart = async (req, res, next) => {
  try {
    const { uploadId, s3Key, parts } = req.body;

    const response = await UPLOAD_SERVICE.onCompleteMultipart({ uploadId, s3Key, parts });
    return res.status(200).json({ success: true, data: response });
  } catch (error) {
    next(error);
  }
};

const onCancelBeacon = async (req, res, next) => {
  try {
    const { failedAttachmentIds } = req.body || {};
    
    await UPLOAD_SERVICE.onCancelBeacon({ failedAttachmentIds });
    
    return res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
};

export const UPLOAD_CONTROLLER = { onPresignUrl, onUpdateStatus, onCompleteMultipart, onCancelBeacon };