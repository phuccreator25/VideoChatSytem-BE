import Joi from "joi";

const COLLECTION_MESSAGE_NAME = "messages";

const messageTypes = {
  TEXT: "text",
  FILE: "file",
  IMAGE: "image",
  VIDEO: "video",
  AUDIO: "audio",
};

const COLLECTION_MESSAGE_SCHEMA = Joi.object({
  conversationId: Joi.string().required().trim(),
  senderId: Joi.string().required().trim(),

  type: Joi.string()
    .valid(...Object.values(messageTypes))
    .required(),

  content: Joi.string().allow(null, "").default(null),

  fileUrl: Joi.string().allow(null, "").default(null),
  fileName: Joi.string().allow(null, "").default(null),
  fileSize: Joi.string().allow(null, "").default(null),

  replyToMessageId: Joi.string().allow(null, "").default(null),

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
  return validated;
};

export const MESSAGE_MODEL = {
  COLLECTION_MESSAGE_NAME,
  COLLECTION_MESSAGE_SCHEMA,
  validateData,
  messageTypes,
};