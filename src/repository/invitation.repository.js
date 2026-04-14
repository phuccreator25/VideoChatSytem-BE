import { GET_DB } from "../config/database.js"
import { INVITATION_MODEL } from "../models/invitation.model.js"
import { USER_MODEL } from "../models/user.model.js"
import { ObjectId } from "mongodb"

const createOne = async(data) => {
    const validData = await INVITATION_MODEL.validateData(data)
    return GET_DB().collection(INVITATION_MODEL.COLECTION_INVITATION_NAME)
                    .insertOne(validData)
}

const findMany = async (filters = {}, options = {}) => {
  const match = {
    deleteAt: null,
    status: "pending",
  };

  if (filters.senderId) match.senderId = filters.senderId;
  if (filters.receiverId) match.receiverId = filters.receiverId;
  if (filters.status) match.status = filters.status;

  const joinField = filters.senderId ? "receiverId" : "senderId";

  return await GET_DB()
    .collection(INVITATION_MODEL.COLECTION_INVITATION_NAME)
    .aggregate([
      { $match: match },
      { $sort: { createdAt: -1 } },
      ...(options.skip !== undefined ? [{ $skip: options.skip }] : []),
      ...(options.limit !== undefined ? [{ $limit: options.limit }] : []),
      {
        $lookup: {
          from: USER_MODEL.COLECTION_USER_NAME,
          let: { userId: `$${joinField}` },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$_id", { $toObjectId: "$$userId" }],
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
          as: "userInfo",
        },
      },
      {
        $unwind: {
          path: "$userInfo",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 0,
          id: "$_id",
          senderId: 1,
          receiverId: 1,
          status: 1,
          message: 1,
          createdAt: 1,
          fullname: "$userInfo.fullname",
          sentAt: "$createdAt",
          receiveAt: "$createdAt",
          avatar: "$userInfo.avatar"
        },
      },
    ])
    .toArray();
};

const countReceived = async (filters = {}) => {
  const match = {
    deleteAt: null,
    status: "pending"
  };

  if (filters.receiverId) match.receiverId = filters.receiverId;
  if (filters.status) match.status = filters.status;

  return await GET_DB()
    .collection(INVITATION_MODEL.COLECTION_INVITATION_NAME)
    .countDocuments(match);
};

const updateById = async (_id, _status) => {
  const fieldUpdate = _status === "accepted" ? "responseAt" : "deleteAt";

  return await GET_DB()
    .collection(INVITATION_MODEL.COLECTION_INVITATION_NAME)
    .findOneAndUpdate(
      { _id: new ObjectId(_id) },
      {
        $set: {
          status: _status,
          [fieldUpdate]: new Date(),
          updatedAt: new Date()
        }
      },
      { returnDocument: "after" }
    );
};

const findById = async(_id) => {
    const data = GET_DB().collection(INVITATION_MODEL.COLECTION_INVITATION_NAME)
                        .findOne({_id: new ObjectId(_id)})
    return data
}

const findByFilter = async(filters) => {
    const data = GET_DB().collection(INVITATION_MODEL.COLECTION_INVITATION_NAME)
                        .findOne(filters)
    return data
}


export const INVITATION_REPOSITORY = {
    createOne, findMany, countReceived, updateById, findById, findByFilter
}