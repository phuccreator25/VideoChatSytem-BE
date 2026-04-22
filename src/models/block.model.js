import Joi from "joi";

const COLLECTION_BLOCK_NAME = "blocks";

const blockStatus = {
  BLOCKED: "blocked",
  UNBLOCKED: "unblocked",
};

const COLLECTION_BLOCK_SCHEMA = Joi.object({
  blockerId: Joi.string().required().trim(),
  blockedId: Joi.string().required().trim(),

  status: Joi.string()
    .valid(...Object.values(blockStatus))
    .default(blockStatus.BLOCKED),

  blockedAt: Joi.date().default(() => new Date()),
  unblockedAt: Joi.date().allow(null).default(null),

  createdAt: Joi.date().default(() => new Date()),
  updatedAt: Joi.date().allow(null).default(null),
});

const validateData = async (data) => {
  const validated = await COLLECTION_BLOCK_SCHEMA.validateAsync(data, {
    abortEarly: false,
    stripUnknown: true,
  });
  return validated;
};

export const BLOCK_MODEL = {
  COLLECTION_BLOCK_NAME,
  COLLECTION_BLOCK_SCHEMA,
  validateData,
  blockStatus,
};