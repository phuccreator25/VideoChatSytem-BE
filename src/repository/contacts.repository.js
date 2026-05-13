import { ObjectId } from "mongodb";
import { GET_DB } from "../config/database.js";
import { CONTACT_MODEL } from "../models/contact.model.js";
import { USER_MODEL } from "../models/user.model.js";
import { BLOCK_MODEL } from "../models/block.model.js";
import { DEVICE_SESSION_MODEL } from "../models/deviceSession.model.js";

const createOne = async (payload, session = null) => {
  const dataValid = await CONTACT_MODEL.validateData(payload);

  return await GET_DB()
    .collection(CONTACT_MODEL.COLLECTION_CONTACT_NAME)
    .insertOne(dataValid, {session});
};

const findByUserId = async (ownerId) => {
  return await GET_DB()
    .collection(CONTACT_MODEL.COLLECTION_CONTACT_NAME)
    .find({ ownerId })
    .toArray();
};

const findContactItem = async (ownerId, targetUserId, session = null) => {
  return await GET_DB()
    .collection(CONTACT_MODEL.COLLECTION_CONTACT_NAME)
    .findOne({
      ownerId,
      contactUserId: targetUserId,
    }, {session});
};

const findUserOnline = async (filter) => {
  const result = await GET_DB()
    .collection(CONTACT_MODEL.COLLECTION_CONTACT_NAME)
    .aggregate([
      {
        $match: {
          ownerId: filter.userId, 
        },
      },
      {
        $lookup: {
          from: USER_MODEL.COLECTION_USER_NAME,
          let: { contactUserId: "$contactUserId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: [{ $toString: "$_id" }, "$$contactUserId"] },
                    { $eq: ["$status", "online"] },
                  ],
                },
              },
            },
            { $limit: 1 },
          ],
          as: "userOnlineInfo",
        },
      },
      {
        $match: {
          "userOnlineInfo.0": { $exists: true },
        },
      },
      {
        $group: {
          _id: null,
          userIds: { $addToSet: "$contactUserId" },
        },
      },
      {
        $project: {
          _id: 0,
          userIds: 1,
        },
      },
    ])
    .toArray();

  return result[0]?.userIds || [];
};

const findMany = async (currentUserId) => {
  const contacts = await GET_DB()
    .collection(CONTACT_MODEL.COLLECTION_CONTACT_NAME)
    .aggregate([
      {
        $match: {
          ownerId: currentUserId,
        },
      },
      {
        $lookup: {
          from: USER_MODEL.COLECTION_USER_NAME,
          let: { friendUserId: "$contactUserId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$_id", { $toObjectId: "$$friendUserId" }],
                },
              },
            },
            {
              $project: {
                _id: 1,
                fullname: 1,
                avatar: 1,
                email: 1,
              },
            },
          ],
          as: "friendInfo",
        },
      },
      {
        $unwind: {
          path: "$friendInfo",
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $lookup: {
          from: BLOCK_MODEL.COLLECTION_BLOCK_NAME,
          let: {
            currentUserId: "$ownerId",
            friendUserId: "$contactUserId",
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$blockerId", "$$currentUserId"] },
                    { $eq: ["$blockedId", "$$friendUserId"] },
                    { $eq: ["$status", BLOCK_MODEL.blockStatus.BLOCKED] },
                  ],
                },
              },
            },
            { $limit: 1 },
            {
              $project: {
                _id: 1,
              },
            },
          ],
          as: "blockInfo",
        },
      },
      {
        $addFields: {
          isBlocked: {
            $gt: [{ $size: "$blockInfo" }, 0],
          },
        },
      },
      {
        $project: {
          _id: 0,
          userId: "$contactUserId",
          fullname: "$friendInfo.fullname",
          avatar: "$friendInfo.avatar",
          nickname: 1,
          email: "$friendInfo.email",
          addedAt: 1,
          isBlocked: 1,
        },
      },
    ])
    .toArray();

  return contacts.sort((a, b) => {
    const nameA =
      (a.nickname && a.nickname.trim()) ||
      (a.fullname && a.fullname.trim()) ||
      "";
    const nameB =
      (b.nickname && b.nickname.trim()) ||
      (b.fullname && b.fullname.trim()) ||
      "";

    return nameA.localeCompare(nameB, "vi", {
      sensitivity: "base",
    });
  });
};

const updateOne = async ({ filter, data }) => {
  return await GET_DB()
    .collection(CONTACT_MODEL.COLLECTION_CONTACT_NAME)
    .findOneAndUpdate(
      {
        ownerId: filter.ownerId,
        contactUserId: filter.contactUserId,
      },
      {
        $set: {
          nickname: data.nickname,
          updatedAt: new Date(),
        },
      },
      {
        returnDocument: "after",
      }
    );
};

const deleteOne = async ({ ownerId, contactUserId }, session = null) => {
  return await GET_DB()
    .collection(CONTACT_MODEL.COLLECTION_CONTACT_NAME)
    .deleteOne({
      ownerId,
      contactUserId,
    }, session);
};

export const CONTACTS_REPOSITORY = {
  createOne,
  findByUserId,
  findContactItem,
  findMany,
  updateOne,
  deleteOne,
  findUserOnline
};