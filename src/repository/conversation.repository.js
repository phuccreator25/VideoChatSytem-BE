import { GET_DB } from "../config/database.js";
import { CONVERSATION_MODEL } from "../models/conversation.model.js";
import { CONVERSATION_PARTICIPANT_MODEL } from "../models/conversationParticipant.model.js";

const COLLECTION_NAME = CONVERSATION_MODEL.COLLECTION_CONVERSATION_NAME;
const PARTICIPANT_COLLECTION_NAME =
  CONVERSATION_PARTICIPANT_MODEL.COLLECTION_CONVERSATION_PARTICIPANT_NAME;

const createOne = async (data, session = null) => {
  const validatedData = await CONVERSATION_MODEL.validateData(data);

  const result = await GET_DB()
    .collection(COLLECTION_NAME)
    .insertOne(validatedData, {session});

  return {
    _id: result.insertedId,
    ...validatedData,
  };
};

const findOne = async (filter = {}) => {
  const result = await GET_DB()
    .collection(COLLECTION_NAME)
    .findOne(filter);

  return result;
};

const findConversationBetweenUser = async (currentUserId, userId) => {
  const userIds = [String(currentUserId), String(userId)];

  const matchedConversation = await GET_DB()
    .collection(CONVERSATION_MODEL.COLLECTION_CONVERSATION_NAME)
    .aggregate([
      {
        $match: {
          type: CONVERSATION_MODEL.conversationTypes.DIRECT,
          status: CONVERSATION_MODEL.conversationStatus.ACTIVE,
        },
      },
      {
        $lookup: {
          from: PARTICIPANT_COLLECTION_NAME,
          let: { conversationIdStr: { $toString: "$_id" } },
          pipeline: [
            {
              $match: {
                leftAt: null,
                $expr: { $eq: ["$conversationId", "$$conversationIdStr"] },
              },
            },
            {
              $project: {
                _id: 0,
                userId: 1,
              },
            },
          ],
          as: "participants",
        },
      },
      {
        $match: {
          $expr: {
            $and: [
              { $eq: [{ $size: "$participants" }, 2] },
              {
                $setEquals: [
                  {
                    $map: {
                      input: "$participants",
                      as: "participant",
                      in: "$$participant.userId",
                    },
                  },
                  userIds,
                ],
              },
            ],
          },
        },
      },
      { $limit: 1 },
    ])
    .next();

  return matchedConversation || null;
};

export const CONVERSATION_REPOSITORY = {
  createOne,
  findOne,
  findConversationBetweenUser,
};
