import Joi from "joi";
import { EMOTIONS } from "../data/message.data.js";

const COLLECTION_MESSAGE_REACTION_NAME = "messageReactions";

const COLLECTION_MESSAGE_REACTION_SCHEMA = Joi.object({
  messageId: Joi.string().required().trim(),
  userId: Joi.string().required().trim(),

  emotion: Joi.string()
    .valid(...EMOTIONS)
    .required(),

  createdAt: Joi.date().default(() => new Date()),
  updatedAt: Joi.date().allow(null).default(null),
});

const validateData = async (data) => {
  const validated = await COLLECTION_MESSAGE_REACTION_SCHEMA.validateAsync(data, {
    abortEarly: false,
    stripUnknown: true,
  });

  return validated;
};

export const MESSAGE_REACTION_MODEL = {
  COLLECTION_MESSAGE_REACTION_NAME,
  COLLECTION_MESSAGE_REACTION_SCHEMA,
  validateData,
};
