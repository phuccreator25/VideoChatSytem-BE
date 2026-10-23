import Joi from "joi";
import { allReportReasons, reportAccountReasons, reportMessageReasons, reportResolutionActions, reportStatuses, reportTargetTypes } from "../data/ticket.data.js";

export const COLLECTION_REPORT_NAME = 'tickets';

export const COLLECTION_REPORT_SCHEMA = Joi.object({
  _id: Joi.any().optional(),
  reporterId: Joi.string().trim().required(),
  targetType: Joi.string()
    .valid(...Object.values(reportTargetTypes))
    .required(),

  targetUserId: Joi.string().trim().required(),

  conversationId: Joi.string()
    .trim()
    .allow(null, '')
    .default(null)
    .when('targetType', {
      is: reportTargetTypes.MESSAGE,
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),

  messageId: Joi.string()
    .trim()
    .allow(null, '')
    .default(null)
    .when('targetType', {
      is: reportTargetTypes.MESSAGE,
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),

  reportedMessageSnapshot: Joi.object({
    content: Joi.string().allow(null, '').default(null),
    mediaUrl: Joi.string().trim().allow(null, '').default(null),
    messageType: Joi.string().trim().default('text'),
    sentAt: Joi.date().allow(null).default(null),
  })
    .allow(null)
    .default(null)
    .when('targetType', {
      is: reportTargetTypes.MESSAGE,
      then: Joi.required(),
      otherwise: Joi.allow(null).default(null),
    }),

  reason: Joi.string()
    .valid(...allReportReasons)
    .required()
    .when('targetType', {
      is: reportTargetTypes.MESSAGE,
      then: Joi.valid(...Object.values(reportMessageReasons)),
    })
    .when('targetType', {
      is: reportTargetTypes.ACCOUNT,
      then: Joi.valid(...Object.values(reportAccountReasons)),
    }),

  description: Joi.string()
    .trim()
    .allow(null, '')
    .default(null)
    .max(300),

  evidenceAttachments: Joi.array() // Bằng chứng account vi phạm
    .items(Joi.string().trim().uri())
    .max(3)
    .default([]),

  status: Joi.string()
    .valid(...Object.values(reportStatuses))
    .default(reportStatuses.PENDING),
  assignedTo: Joi.string().trim().allow(null, '').default(null),
  assignedAt: Joi.date().allow(null).default(null),
  resolutionActions: Joi.array()
    .items(Joi.string().valid(...Object.values(reportResolutionActions)))
    .max(3)
    .default([]),
  feedbackToReporter: Joi.string().trim().max(500).allow(null, '').default(null),
  adminNotes: Joi.string().trim().max(1000).allow(null, '').default(null),
  resolvedAt: Joi.date().allow(null).default(null),
  unBannedAt: Joi.date().allow(null).default(null),

  createdAt: Joi.date().default(() => new Date()),
  updatedAt: Joi.date().allow(null).default(null),
});

const validateData = async (data) => {
  const validated = await COLLECTION_REPORT_SCHEMA.validateAsync(data, {
    abortEarly: false,
    stripUnknown: true,
  });
  
  return validated;
};

export const TICKET_MODEL = {
  COLLECTION_REPORT_NAME,
  COLLECTION_REPORT_SCHEMA,
  validateData,
};