import Joi from "joi";

const COLLECTION_CONTACT_NAME = "contacts";

const COLLECTION_CONTACT_SCHEMA = Joi.object({
  ownerId: Joi.string().required().trim(),
  contactUserId: Joi.string().required().trim(),
  nickname: Joi.string().allow(null, "").trim().default(null),
  addedAt: Joi.date().default(() => new Date()),
  createdAt: Joi.date().default(() => new Date()),
  updatedAt: Joi.date().allow(null).default(null),
});

const validateData = async (data) => {
  const validated = await COLLECTION_CONTACT_SCHEMA.validateAsync(data, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (validated.ownerId === validated.contactUserId) {
    throw new Error("A user cannot add themselves as a contact");
  }

  return validated;
};

export const CONTACT_MODEL = {
  COLLECTION_CONTACT_NAME,
  COLLECTION_CONTACT_SCHEMA,
  validateData,
};