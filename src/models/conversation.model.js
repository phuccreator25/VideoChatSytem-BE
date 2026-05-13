import Joi from "joi";

const COLLECTION_CONVERSATION_NAME = "conversations";

const conversationTypes = {
  DIRECT: "direct",
  GROUP: "group",
};

const conversationStatus = {
  ACTIVE: "active",
  ARCHIVED: "archived",
  DELETED: "deleted",
};

const COLLECTION_CONVERSATION_SCHEMA = Joi.object({
  name: Joi.string().trim().allow(null, "").default(null),

  type: Joi.string()
    .valid(...Object.values(conversationTypes))
    .required(),

  avatar: Joi.string().trim().allow(null, "").default(null),

  created_by: Joi.string().required().trim(),

  lastMessageAt: Joi.date().allow(null).default(null),
  lastMessageId: Joi.string().trim().allow(null, "").default(null),

  status: Joi.string()
    .valid(...Object.values(conversationStatus))
    .default(conversationStatus.ACTIVE),

  createdAt: Joi.date().default(() => new Date()),
  updatedAt: Joi.date().allow(null).default(null),
});

const validateData = async (data) => {
  const validated = await COLLECTION_CONVERSATION_SCHEMA.validateAsync(data, {
    abortEarly: false,
    stripUnknown: true,
  });
  return validated;
};

export const CONVERSATION_MODEL = {
  COLLECTION_CONVERSATION_NAME,
  COLLECTION_CONVERSATION_SCHEMA,
  validateData,
  conversationTypes,
  conversationStatus,
};