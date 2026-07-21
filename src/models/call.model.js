import Joi from "joi";
import { callTypes, callStatuses, participantRoles, participantStatuses } from "../data/call.data.js";

const COLLECTION_CALL_NAME = "calls";

const COLLECTION_CALL_SCHEMA = Joi.object({
    conversationId: Joi.string().required().trim(),

    type: Joi.string()
        .valid(...Object.values(callTypes))
        .required(),

    status: Joi.string()
        .valid(...Object.values(callStatuses))
        .default(callStatuses.RINGING),

    startedAt: Joi.date().allow(null).default(null),
    endedAt: Joi.date().allow(null).default(null),

    participants: Joi.array()
        .items(
            Joi.object({
                userId: Joi.string().required().trim(),

                role: Joi.string()
                    .valid(...Object.values(participantRoles))
                    .required(),

                joinStatus: Joi.string()
                    .valid(...Object.values(participantStatuses))
                    .default(participantStatuses.PENDING),

                joinedAt: Joi.date().allow(null).default(null),
                leftAt: Joi.date().allow(null).default(null),
            })
        )
        .min(2)
        .required(),

    transcript: Joi.array()
        .items(
            Joi.object({
                speaker: Joi.string().required().trim(),
                text: Joi.string().required().trim(),
                timestamp: Joi.string().required().trim(),
            })
        )
        .allow(null)
        .default(null),

    createdAt: Joi.date().default(() => new Date()),
    updatedAt: Joi.date().allow(null).default(null),
});

const validateData = async (data) => {
    const validated = await COLLECTION_CALL_SCHEMA.validateAsync(data, {
        abortEarly: false,
        stripUnknown: true,
    });

    const hasCaller = validated.participants.some(p => p.role === participantRoles.CALLER);
    const hasCallee = validated.participants.some(p => p.role === participantRoles.CALLEE);

    if (!hasCaller || !hasCallee) {
        throw new Error("A call must have at least one caller and one callee.");
    }

    return validated;
};

export const CALL_MODEL = {
    COLLECTION_CALL_NAME,
    COLLECTION_CALL_SCHEMA,
    validateData,
    callTypes,
    callStatuses,
    participantRoles,
    participantStatuses,
};