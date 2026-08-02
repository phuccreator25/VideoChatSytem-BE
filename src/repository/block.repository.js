import { GET_DB } from "../config/database.js";
import { BLOCK_MODEL } from "../models/block.model.js"

const createOne = async(data) => {
    const validData = await BLOCK_MODEL.validateData(data);
    return GET_DB().collection(BLOCK_MODEL.COLLECTION_BLOCK_NAME).insertOne(validData)
}

const findByBlock = async(blockerId, blockedId) => {
    return await GET_DB().collection(BLOCK_MODEL.COLLECTION_BLOCK_NAME)
                        .findOne({
                            blockerId,
                            blockedId
                        });
}

const updateOne = async ({ filter, data }) => {
  return await GET_DB()
    .collection(BLOCK_MODEL.COLLECTION_BLOCK_NAME)
    .findOneAndUpdate(
      {
        blockerId: filter.blockerId,
        blockedId: filter.blockedId,
      },
      {
        $set: {
          ...data,
          updatedAt: new Date(),
        },
      },
      {
        returnDocument: "after",
      }
    );
};

const findBlockStatusBetweenUsers = async (currentUserId, otherUserId) => {
  const blocks = await GET_DB()
    .collection(BLOCK_MODEL.COLLECTION_BLOCK_NAME)
    .find({
      $or: [
        { blockerId: currentUserId, blockedId: otherUserId },
        { blockerId: otherUserId, blockedId: currentUserId },
      ],
      status: "blocked",
    })
    .toArray();

  const isBlockedByMe = blocks.some(
    (b) => b.blockerId === currentUserId && b.status === "blocked"
  );
  const isBlockedMe = blocks.some(
    (b) => b.blockerId === otherUserId && b.status === "blocked"
  );

  return { isBlockedByMe, isBlockedMe };
};


export const BLOCK_REPOSITORY = {
    createOne, findByBlock, updateOne, findBlockStatusBetweenUsers
}