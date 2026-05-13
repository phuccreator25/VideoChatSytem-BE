import { GET_DB } from "../config/database.js";
import { CONVERSATION_PARTICIPANT_MODEL } from "../models/conversationParticipant.model.js";

const findOtherUserIdByConversation = async (conversationId, currentUserId) => {
  const participants = await GET_DB()
    .collection( CONVERSATION_PARTICIPANT_MODEL.COLLECTION_CONVERSATION_PARTICIPANT_NAME)
    .find({
      conversationId,
      leftAt: null,
    })
    .toArray();

  if (!participants.length) return null;

  const hasCurrentUser = participants.some((item) => item.userId === currentUserId);
  if (!hasCurrentUser) return null;

  const otherParticipant = participants.find((item) => item.userId !== currentUserId);

  return otherParticipant?.userId || null;
};

const createOne = async (data, session = null) => {
  const validatedData = await CONVERSATION_PARTICIPANT_MODEL.validateData(data);
  return await GET_DB()
    .collection(CONVERSATION_PARTICIPANT_MODEL.COLLECTION_CONVERSATION_PARTICIPANT_NAME)
    .insertOne(validatedData, {session});
}

export const CONVERSATION_PARTICIPANT_REPOSITORY = {
  findOtherUserIdByConversation, createOne
};
