import Joi from "joi";

const COLECTION_DEVICE_SESSION_NAME = 'deviceSession'

const COLECTION_DEVICE_SESSION_SCHEMA = Joi.object({
  sessionId: Joi.string().trim().required(), // ID của phiên, do server sinh
  userId: Joi.string().trim().required(),

  deviceId: Joi.string().trim().allow('').default(''), // fingerprint/browserKey, metadata thôi
  name: Joi.string().trim().max(255).allow('').default(''),
  userAgent: Joi.string().trim().allow('').default(''),
  ipAddress: Joi.string().trim().allow('').default(''),

  refreshToken: Joi.string().trim().required(),

  expiredAt: Joi.date().required(),
  revokedAt: Joi.date().allow(null).default(null),
  lastSeenAt: Joi.date().default(() => new Date()),

  createdAt: Joi.date().default(() => new Date()),
  updatedAt: Joi.date().allow(null).default(null)
})

const validateData = async (data) => {
  return await COLECTION_DEVICE_SESSION_SCHEMA.validateAsync(data, {
    abortEarly: false,
    stripUnknown: true
  })
}

export const DEVICE_SESSION_MODEL = {
  validateData,
  COLECTION_DEVICE_SESSION_NAME,
  COLECTION_DEVICE_SESSION_SCHEMA
}