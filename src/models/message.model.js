import Joi from "joi";
import { messageTypes } from "../data/message.data.js";

const COLLECTION_MESSAGE_NAME = "messages";

const COLLECTION_MESSAGE_SCHEMA = Joi.object({
  conversationId: Joi.string().required().trim(),
  senderId: Joi.string().required().trim(),

  type: Joi.string()
    .valid(...Object.values(messageTypes))
    .required(),

  content: Joi.string().trim().allow(null, "").default(null),

  fileUrl: Joi.string().trim().allow(null, "").default(null),
  fileName: Joi.string().trim().allow(null, "").default(null),
  fileSize: Joi.number().integer().min(0).allow(null).default(null),

  replyToMessageId: Joi.string().trim().allow(null, "").default(null),

  isEdited: Joi.boolean().default(false),
  editedAt: Joi.date().allow(null).default(null),

  isDeleted: Joi.boolean().default(false),
  deletedAt: Joi.date().allow(null).default(null),

  createdAt: Joi.date().default(() => new Date()),
  updatedAt: Joi.date().allow(null).default(null),
});

const validateData = async (data) => {
  const validated = await COLLECTION_MESSAGE_SCHEMA.validateAsync(data, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (
    validated.type === messageTypes.TEXT &&
    (!validated.content || !validated.content.trim())
  ) {
    throw new Error("Text message content is required");
  }

  if (
    validated.type !== messageTypes.TEXT &&
    (!validated.fileUrl || !validated.fileUrl.trim())
  ) {
    throw new Error("fileUrl is required for non-text message");
  }

  return validated;
};

export const MESSAGE_MODEL = {
  COLLECTION_MESSAGE_NAME,
  COLLECTION_MESSAGE_SCHEMA,
  validateData,
  messageTypes,
};
