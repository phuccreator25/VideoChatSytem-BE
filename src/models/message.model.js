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

  attachments: Joi.array()
    .items(
      Joi.object({
        attachmentId: Joi.string().trim().required(),
        tempAttachmentId: Joi.string().trim().allow(null, "").default(null),

        fileUrl: Joi.string().trim().allow(null, "").default(null),
        publicId: Joi.string().trim().allow(null, "").default(null),

        fileName: Joi.string().trim().required(),
        fileSize: Joi.number().integer().min(0).required(),
        mimeType: Joi.string().trim().required(),

        width: Joi.number().integer().min(0).allow(null).default(null),
        height: Joi.number().integer().min(0).allow(null).default(null),

        resourceType: Joi.string()
          .valid("image", "video", "raw", "audio")
          .default("image"),

        status: Joi.string()
          .valid("pending", "uploading", "done", "failed")
          .default("pending"),

        recordDuration: Joi.number().allow(null).default(null),

        createdAt: Joi.date().default(() => new Date()),
        updatedAt: Joi.date().allow(null).default(null),
      }),
    )
    .default([]),

  preview: Joi.object({
    title: Joi.string().allow(null, "").default(null),
    description: Joi.string().allow(null, "").default(null),
    image: Joi.string().allow(null, "").default(null),
    url: Joi.string().allow(null, "").default(null),
    siteName: Joi.string().allow(null, "").default(null),
    domain: Joi.string().allow(null, "").default(null),
  })
    .allow(null)
    .default(null),

  replyToMessageId: Joi.string().trim().allow(null, "").default(null),

  isEdited: Joi.boolean().default(false),
  editedAt: Joi.date().allow(null).default(null),

  gifUrl: Joi.string().trim().allow(null, "").default(null),

  deletedBy: Joi.array().items(Joi.string().trim()).default([]),

  isRevoked: Joi.boolean().default(false),
  revokedAt: Joi.date().allow(null).default(null),

  sendStatus: Joi.string().valid("sent", "failed").default("sent"),

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

  return validated;
};

export const MESSAGE_MODEL = {
  COLLECTION_MESSAGE_NAME,
  COLLECTION_MESSAGE_SCHEMA,
  validateData,
  messageTypes,
};
