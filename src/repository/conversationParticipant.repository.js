import { GET_DB } from "../config/database.js";
import { CONVERSATION_PARTICIPANT_MODEL } from "../models/conversationParticipant.model.js";

const findOtherUserIdByConversation = async (conversationId, currentUserId) => {
  const participantCollection = GET_DB().collection(
    CONVERSATION_PARTICIPANT_MODEL.COLLECTION_CONVERSATION_PARTICIPANT_NAME
  );

  const result = await participantCollection
    .aggregate([
      {
        $match: {
          conversationId,
          leftAt: null,
        },
      },
      {
        $facet: { // Cho phép chạy sog sog nhiều pinepile cùng luc
          currentUser: [
            {
              $match: {
                userId: currentUserId,
              },
            },
            { $limit: 1 },
            {
              $project: {
                _id: 1,
              },
            },
          ],
          otherUser: [
            {
              $match: {
                userId: { $ne: currentUserId },
              },
            },
            { $limit: 1 },
            {
              $project: {
                _id: 0,
                userId: 1,
              },
            },
          ],
        },
      },
      {
        $project: {
          hasCurrentUser: {
            $gt: [{ $size: "$currentUser" }, 0],
          },
          otherUserId: {
            $arrayElemAt: ["$otherUser.userId", 0],
          },
        },
      },
    ])
    .next();

  if (!result?.hasCurrentUser) return null;

  return result.otherUserId || null;
};

const createOne = async (data, session = null) => {
  const validatedData = await CONVERSATION_PARTICIPANT_MODEL.validateData(data);
  return await GET_DB()
    .collection(CONVERSATION_PARTICIPANT_MODEL.COLLECTION_CONVERSATION_PARTICIPANT_NAME)
    .insertOne(validatedData, {session});
}

const findOne = async (filter = {}, session = null) => {
  const options = session ? { session } : undefined;

  const result = await GET_DB()
    .collection(CONVERSATION_PARTICIPANT_MODEL.COLLECTION_CONVERSATION_PARTICIPANT_NAME)
    .findOne(filter, options);

  return result;
};

const find = async (filter = {}, session = null) => {
  const options = session ? { session } : undefined;

  const result = await GET_DB()
    .collection(CONVERSATION_PARTICIPANT_MODEL.COLLECTION_CONVERSATION_PARTICIPANT_NAME)
    .find(filter, options)
    .toArray();

  return result;
};

const updateOne = async(filter = {}, updateData, session = null) => {
  const options = session ? { session } : undefined;

  const result = await GET_DB()
    .collection(CONVERSATION_PARTICIPANT_MODEL.COLLECTION_CONVERSATION_PARTICIPANT_NAME)
    .updateOne(filter, updateData, options);

  return result;
}

export const CONVERSATION_PARTICIPANT_REPOSITORY = {
  findOtherUserIdByConversation, createOne, findOne, find, updateOne
};
