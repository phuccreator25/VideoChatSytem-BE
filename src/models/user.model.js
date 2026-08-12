import Joi from "joi";
import { role, status } from "../data/user.data.js";

const COLECTION_USER_NAME = 'users'

export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

const PASSWORD_SCHEMA = Joi.string()
  .min(8)
  .pattern(PASSWORD_REGEX)
  .required()
  .messages({
    "string.min": "Mật khẩu phải chứa ít nhất 8 ký tự",
    "string.pattern.base": "Mật khẩu phải chứa ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường, chữ số và ký tự đặc biệt",
    "string.empty": "Vui lòng nhập mật khẩu",
  });

const COLECTION_USER_SCHEMA = Joi.object({
  email: Joi.string().trim().email().required(),
  password: PASSWORD_SCHEMA,
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
  
  verifyToken: Joi.string().default(null),
  expiredVerifyTokenAt: Joi.date().default(null),

  createdAt: Joi.date().default(() => new Date()),
  updatedAt: Joi.date().allow(null).default(null)
})

const validateData = async (data) => {
  return await COLECTION_USER_SCHEMA.validateAsync(data, {
    abortEarly: false,
    stripUnknown: true
  })
}

const validatePassword = (password) => {
  const { error, value } = PASSWORD_SCHEMA.validate(password);
  if (error) {
    throw new Error(error.details[0].message);
  }
  return value;
}

export const USER_MODEL = {
  validateData,
  validatePassword,
  COLECTION_USER_NAME,
  COLECTION_USER_SCHEMA,
  PASSWORD_REGEX,
}