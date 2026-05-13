import Joi from "joi";

const COLLECTION_MESSAGE_DELIVERY_NAME = "messageDeliveries";

const COLLECTION_MESSAGE_DELIVERY_SCHEMA = Joi.object({
  messageId: Joi.string().required().trim(),
  userId: Joi.string().required().trim(),

  readAt: Joi.date().allow(null).default(null),
  deliveredAt: Joi.date().allow(null).default(null),

  createdAt: Joi.date().default(() => new Date()),
  updatedAt: Joi.date().allow(null).default(null),
});

const validateData = async (data) => {
  const validated = await COLLECTION_MESSAGE_DELIVERY_SCHEMA.validateAsync(data, {
    abortEarly: false,
    stripUnknown: true,
  });
  return validated;
};

export const MESSAGE_DELIVERY_MODEL = {
  COLLECTION_MESSAGE_DELIVERY_NAME,
  COLLECTION_MESSAGE_DELIVERY_SCHEMA,
  validateData,
};