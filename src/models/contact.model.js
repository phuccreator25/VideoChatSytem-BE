import Joi from "joi";

const COLECTION_CONTACT_NAME = "contacts";

const contactItemSchema = Joi.object({
  userId: Joi.string().required(),
  addedAt: Joi.date().default(() => new Date()),
  nickname: Joi.string().allow(null, "").default(null),
});

const COLECTION_CONTACT_SCHEMA = Joi.object({
  userId: Joi.string().required(),
  contactUserId: Joi.array().items(contactItemSchema).default([]),
  createdAt: Joi.date().default(() => new Date()),
  updatedAt: Joi.date().allow(null).default(null),
});

const validateData = async (data) => {
  return await COLECTION_CONTACT_SCHEMA.validateAsync(data, {
    abortEarly: false,
    stripUnknown: true,
  });
};

export const CONTACT_MODEL = {
  validateData,
  COLECTION_CONTACT_NAME,
  COLECTION_CONTACT_SCHEMA,
};