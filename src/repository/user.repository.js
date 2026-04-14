import { USER_MODEL } from '../models/user.model.js'
import{GET_DB} from '../config/database.js'
import { ObjectId } from 'mongodb';
import { INVITATION_MODEL } from '../models/invitation.model.js';
import { invitationStatus } from '../data/invitation.data.js';

const createOne = async (data) => {
    const dataValidate = await USER_MODEL.validateData(data)
    return GET_DB().collection(USER_MODEL.COLECTION_USER_NAME).insertOne(dataValidate);    
}

const activeAcount = async (email) => {
  const result = await GET_DB()
    .collection(USER_MODEL.COLECTION_USER_NAME)
    .findOneAndUpdate(
      { email, isActive: false },
      {
        $set: {
          isActive: true,
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

  return result;
};

const findById = async(_id) => {
    const data = GET_DB().collection(USER_MODEL.COLECTION_USER_NAME)
                        .findOne({_id: new ObjectId(_id)})
    return data
}

const findByEmail = async(data) => {
    const user = GET_DB().collection(USER_MODEL.COLECTION_USER_NAME)
                        .findOne({email: data})
    return user
}

const findByUser = async ({ keyword, currentUserId }) => {
  if (!keyword?.trim()) return [];

  const currentUserObjectId = new ObjectId(currentUserId);
  const keywordTrim = keyword.trim();

  const data = await GET_DB()
    .collection(USER_MODEL.COLECTION_USER_NAME)
    .aggregate([
      {
        $match: {
          _id: { $ne: currentUserObjectId },
          isBanned: false,
          isActive: true,
          $or: [
            { email: { $regex: keywordTrim, $options: "i" } },
            { fullname: { $regex: keywordTrim, $options: "i" } }
          ]
        }
      },
      {
        $lookup: {
          from: INVITATION_MODEL.COLECTION_INVITATION_NAME,
          let: {
            targetUserId: { $toString: "$_id" },
            currentUserId: currentUserId
          },
          pipeline: [
            {
              $match: {
                deleteAt: null,
                $expr: {
                  $or: [
                    {
                      $and: [
                        { $eq: ["$senderId", "$$currentUserId"] },
                        { $eq: ["$receiverId", "$$targetUserId"] }
                      ]
                    },
                    {
                      $and: [
                        { $eq: ["$senderId", "$$targetUserId"] },
                        { $eq: ["$receiverId", "$$currentUserId"] }
                      ]
                    }
                  ]
                }
              }
            },
            { $sort: { createdAt: -1 } },
            { $limit: 1 },
            {
              $project: {
                _id: 1,
                senderId: 1,
                receiverId: 1,
                status: 1
              }
            }
          ],
          as: "relationInfo"
        }
      },
      {
        $addFields: {
          relationInfo: { $arrayElemAt: ["$relationInfo", 0] }
        }
      },
      {
        $addFields: {
          relationStatus: {
            $switch: {
              branches: [
                {
                  case: {
                    $eq: ["$relationInfo.status", invitationStatus.ACCEPTED]
                  },
                  then: "accepted"
                },
                {
                  case: {
                    $and: [
                      { $eq: ["$relationInfo.status", invitationStatus.PENDING] },
                      { $eq: ["$relationInfo.senderId", currentUserId] }
                    ]
                  },
                  then: "pending_sent"
                },
                {
                  case: {
                    $and: [
                      { $eq: ["$relationInfo.status", invitationStatus.PENDING] },
                      { $eq: ["$relationInfo.receiverId", currentUserId] }
                    ]
                  },
                  then: "pending_received"
                }
              ],
              default: "none"
            }
          }
        }
      },
      {
        $project: {
          _id: 1,
          fullname: 1,
          email: 1,
          avatar: 1,
          relationStatus: 1,
          invitationId: "$relationInfo._id"
        }
      }
    ])
    .toArray();

  return data;
};

const updateOne = async (data) => {
  return GET_DB()
    .collection(USER_MODEL.COLECTION_USER_NAME)
    .updateOne(
      { email: data.email },
      {
        $set: {
          password: data.password
        }
      }
    )
}

const updateById = async ({ _id, data }) => {
  const result = await GET_DB()
    .collection(USER_MODEL.COLECTION_USER_NAME)
    .findOneAndUpdate(
      { _id: new ObjectId(_id) },
      { $set: data },
      { returnDocument: "after" }
    );

  return result;
};

export const USER_REPOSITORY = {
    createOne, findById, findByEmail, activeAcount, updateOne, updateById, findByUser
}