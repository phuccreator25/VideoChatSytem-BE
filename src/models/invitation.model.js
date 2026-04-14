import Joi from "joi";
import { invitationStatus } from "../data/invitation.data.js";

const COLECTION_INVITATION_NAME = "invitations";

const COLECTION_INVITATION_SCHEMA = Joi.object({
  senderId: Joi.string().required(),
  receiverId: Joi.string().required(),

  message: Joi.string().trim().allow("").default(""),

  status: Joi.string()
    .valid(...Object.values(invitationStatus))
    .default(invitationStatus.PENDING),

  responseAt: Joi.date().allow(null).default(null),

  deleteAt: Joi.date().allow(null).default(null),

  createdAt: Joi.date().default(() => new Date()),
  updatedAt: Joi.date().allow(null).default(null)
});

const validateData = async (data) => {
  return await COLECTION_INVITATION_SCHEMA.validateAsync(data, {
    abortEarly: false,
    stripUnknown: true
  });
};

export const INVITATION_MODEL = {
  validateData,
  COLECTION_INVITATION_NAME,
  COLECTION_INVITATION_SCHEMA
};