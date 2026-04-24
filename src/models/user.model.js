import Joi from "joi";
import { role, status } from "../data/user.data.js";

const COLECTION_USER_NAME = 'users'

const COLECTION_USER_SCHEMA = Joi.object({
  email: Joi.string().trim().email().required(),
  password: Joi.string().min(6).required(),
  username: Joi.string().trim().min(3).max(30).default(null),
  fullname: Joi.string().trim().min(2).max(100).required(),

  status: Joi.string()
    .valid(...Object.values(status))
    .default(status.OFFLINE),

  isBanned: Joi.boolean().default(false),

  bannedBy: Joi.string().allow(null, '').default(null),

  banReason: Joi.string().trim().allow('').default(''),
  bannedAt: Joi.date().allow(null).default(null),

  isActive: Joi.boolean().default(false),
  isOnline: Joi.boolean().default(false),
  lastSeenAt: Joi.date().allow(null).default(null),

  avatar: Joi.string().trim().allow('').default(''),

  role: Joi.string()
    .valid(...Object.values(role))
    .default(role.CLIENT),
  
  codeReset: Joi.number().default(null),
  expiredCodeResetAt: Joi.date().default(null),

  createdAt: Joi.date().default(() => new Date()),
  updatedAt: Joi.date().allow(null).default(null)
})

const validateData = async (data) => {
  return await COLECTION_USER_SCHEMA.validateAsync(data, {
    abortEarly: false,
    stripUnknown: true
  })
}

export const USER_MODEL = {
  validateData,
  COLECTION_USER_NAME,
  COLECTION_USER_SCHEMA
}