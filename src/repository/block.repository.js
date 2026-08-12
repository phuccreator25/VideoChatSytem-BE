import { ObjectId } from "mongodb";
import { GET_DB } from "../config/database.js";
import { BLOCK_MODEL } from "../models/block.model.js"
import { USER_MODEL } from "../models/user.model.js";

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


const findMany = async({ blockerId }) => {
  const blocks = await GET_DB()
    .collection(BLOCK_MODEL.COLLECTION_BLOCK_NAME)
    .aggregate([
      {
        $match: {
          blockerId: blockerId,
          status: "blocked"
        }
      },
      {
        $lookup: {
          from: USER_MODEL.COLECTION_USER_NAME,
          let: { blockedId: "$blockedId" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$_id", { $toObjectId: "$$blockedId" }] }
              }
            }
          ],
          as: "userBlock",
        },
      },
      // Chuyển về dạng Object
      {
        $unwind: {
          path: "$userBlock",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          _id: 0,
          blockId: "$_id",
          userId: "$blockedId",
          name: '$userBlock.fullname',
          avatar: '$userBlock.avatar',
          blockAt: '$createdAt',
        }
      }
    ]).toArray();

    return blocks.map(block => ({
        ...block,
        blockId: block.blockId.toString(),
        blockAt: block.blockAt.toString()
    }))
}

export const BLOCK_REPOSITORY = {
    createOne, findByBlock, updateOne, findBlockStatusBetweenUsers, findMany
}