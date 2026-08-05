import Joi from "joi";

const COLLECTION_CONVERSATION_PARTICIPANT_NAME = "conversationParticipants";

const participantRoles = {
  MEMBER: "member",
  ADMIN: "admin",
  OWNER: "owner",
};

const COLLECTION_CONVERSATION_PARTICIPANT_SCHEMA = Joi.object({
  conversationId: Joi.string().required().trim(),
  userId: Joi.string().required().trim(),

  role: Joi.string()
    .valid(...Object.values(participantRoles))
    .default(participantRoles.MEMBER),

  joinAt: Joi.date().default(() => new Date()),
  leftAt: Joi.date().allow(null).default(null),

  deletedAt: Joi.date().allow(null).default(null),

  isMuted: Joi.boolean().default(false),

  createdAt: Joi.date().default(() => new Date()),
  updatedAt: Joi.date().allow(null).default(null),
});

const validateData = async (data) => {
  const validated = await COLLECTION_CONVERSATION_PARTICIPANT_SCHEMA.validateAsync(data, {
    abortEarly: false,
    stripUnknown: true,
  });
  return validated;
};

export const CONVERSATION_PARTICIPANT_MODEL = {
  COLLECTION_CONVERSATION_PARTICIPANT_NAME,
  COLLECTION_CONVERSATION_PARTICIPANT_SCHEMA,
  validateData,
  participantRoles,
};