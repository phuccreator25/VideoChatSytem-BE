import { GET_DB } from "../config/database.js";
import { CONTACT_MODEL } from "../models/contact.model.js";
import { USER_MODEL } from "../models/user.model.js";

const createOne = async (payload) => {
  const dataValid = await CONTACT_MODEL.validateData(payload);
  return GET_DB()
    .collection(CONTACT_MODEL.COLECTION_CONTACT_NAME)
    .insertOne(dataValid);
};

const findByUserId = async (_id) => {
  return await GET_DB()
    .collection(CONTACT_MODEL.COLECTION_CONTACT_NAME)
    .findOne({
      userId: _id,
    });
};

const findContactItem = async (ownerUserId, targetUserId) => {
  return await GET_DB()
    .collection(CONTACT_MODEL.COLECTION_CONTACT_NAME)
    .findOne(
      {
        userId: ownerUserId,
        "contactUserId.userId": targetUserId,
      },
      {
        projection: {
          contactUserId: {
            $elemMatch: { userId: targetUserId },
          },
        },
      },
    );
};

const findMany = async (currentUserId) => {
  const contacts = await GET_DB()
    .collection(CONTACT_MODEL.COLECTION_CONTACT_NAME)
    .aggregate([
      {
        $match: {
          userId: currentUserId,
        },
      },
      {
        $unwind: {
          path: "$contactUserId",
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $lookup: {
          from: USER_MODEL.COLECTION_USER_NAME,
          let: { friendUserId: "$contactUserId.userId" },
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
        $project: {
          _id: 0,
          userId: "$contactUserId.userId",
          fullname: "$friendInfo.fullname",
          avatar: "$friendInfo.avatar",
          nickname: "$contactUserId.nickname",
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

const pushContactUser = async (ownerUserId, contactData) => {
  return await GET_DB()
    .collection(CONTACT_MODEL.COLECTION_CONTACT_NAME)
    .updateOne(
      { userId: ownerUserId },
      {
        $push: {
          contactUserId: contactData,
        },
        $set: {
          updatedAt: new Date(),
        },
      },
    );
};

export const CONTACTS_REPOSITORY = {
  createOne,
  findByUserId,
  findContactItem,
  findMany,
  pushContactUser,
};
