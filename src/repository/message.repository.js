import { GET_DB } from "../config/database.js";
import { MESSAGE_MODEL } from "../models/message.model.js";

const COLLECTION_NAME = MESSAGE_MODEL.COLLECTION_MESSAGE_NAME;

const createOne = async (data) => {
  const validatedData = await MESSAGE_MODEL.validateData(data);

  const result = await GET_DB()
    .collection(COLLECTION_NAME)
    .insertOne(validatedData);

  return {
    _id: result.insertedId,
    ...validatedData,
  };
};

const findByConversationId = async (
  conversationId,
  { limit = 30, skip = 0, sort = { createdAt: 1 } } = {}
) => {
  const result = await GET_DB()
    .collection(COLLECTION_NAME)
    .find({
      conversationId,
      isDeleted: false,
    })
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .toArray();

  return result;
};

export const MESSAGE_REPOSITORY = {
  createOne,
  findByConversationId,
};