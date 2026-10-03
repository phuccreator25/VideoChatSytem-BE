import { USER_MODEL } from "../models/user.model.js";
import { GET_DB } from "../config/database.js";
import { ObjectId } from "mongodb";
import { INVITATION_MODEL } from "../models/invitation.model.js";
import { invitationStatus } from "../data/invitation.data.js";
import { CONTACT_MODEL } from "../models/contact.model.js";
import { isUserOnline } from "../sockets/socketStore.js";

const createOne = async (data) => {
  const dataValidate = await USER_MODEL.validateData(data);
  return GET_DB()
    .collection(USER_MODEL.COLECTION_USER_NAME)
    .insertOne(dataValidate);
};

const activeAcount = async (token) => {
  const result = await GET_DB()
    .collection(USER_MODEL.COLECTION_USER_NAME)
    .findOneAndUpdate(
      {
        verifyToken: token,
        isActive: false,
        expiredVerifyTokenAt: { $gt: new Date() },
      },
      {
        $set: {
          isActive: true,
          updatedAt: new Date(),
        },
        $unset: {
          verifyToken: null,
          expiredVerifyTokenAt: null,
        },
      },
      { returnDocument: "after" }
    );

  return result;
};

const findById = async (_id) => {
  const data = GET_DB()
    .collection(USER_MODEL.COLECTION_USER_NAME)
    .findOne({ _id: new ObjectId(_id) });
  return data;
};

const findByEmail = async (data) => {
  const user = GET_DB()
    .collection(USER_MODEL.COLECTION_USER_NAME)
    .findOne({ email: data });
  return user;
};

const findByUsername = async (data) => {
  const user = GET_DB()
    .collection(USER_MODEL.COLECTION_USER_NAME)
    .findOne({ username: data });
  return user;
};


const findByToken = async (data) => {
  const user = GET_DB()
    .collection(USER_MODEL.COLECTION_USER_NAME)
    .findOne({ verifyToken: data });
  return user;
};

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
            { fullname: { $regex: keywordTrim, $options: "i" } },
          ],
        },
      },
      {
        $lookup: {
          from: INVITATION_MODEL.COLECTION_INVITATION_NAME,
          let: {
            targetUserId: { $toString: "$_id" },
            currentUserId: currentUserId,
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
                        { $eq: ["$receiverId", "$$targetUserId"] },
                      ],
                    },
                    {
                      $and: [
                        { $eq: ["$senderId", "$$targetUserId"] },
                        { $eq: ["$receiverId", "$$currentUserId"] },
                      ],
                    },
                  ],
                },
              },
            },
            { $sort: { createdAt: -1 } },
            { $limit: 1 },
            {
              $project: {
                _id: 1,
                senderId: 1,
                receiverId: 1,
                status: 1,
              },
            },
          ],
          as: "relationInfo",
        },
      },
      {
        $lookup: {
          from: CONTACT_MODEL.COLLECTION_CONTACT_NAME,
          let: {
            targetUserId: { $toString: "$_id" },
            currentUserId: currentUserId,
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$ownerId", "$$currentUserId"] },
                    { $eq: ["$contactUserId", "$$targetUserId"] },
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
          as: "contactInfo",
        },
      },
      {
        $addFields: {
          relationInfo: { $arrayElemAt: ["$relationInfo", 0] },
          hasContact: { $gt: [{ $size: "$contactInfo" }, 0] },
        },
      },
      {
        $addFields: {
          relationStatus: {
            $switch: {
              branches: [
                {
                  case: "$hasContact",
                  then: "accepted",
                },
                {
                  case: {
                    $and: [
                      {
                        $eq: ["$relationInfo.status", invitationStatus.PENDING],
                      },
                      { $eq: ["$relationInfo.senderId", currentUserId] },
                    ],
                  },
                  then: "pending_sent",
                },
                {
                  case: {
                    $and: [
                      {
                        $eq: ["$relationInfo.status", invitationStatus.PENDING],
                      },
                      { $eq: ["$relationInfo.receiverId", currentUserId] },
                    ],
                  },
                  then: "pending_received",
                },
              ],
              default: "none",
            },
          },
        },
      },
      {
        $project: {
          _id: 1,
          fullname: 1,
          email: 1,
          avatar: 1,
          relationStatus: 1,
          invitationId: "$relationInfo._id",
        },
      },
    ])
    .toArray();

  return data;
};

const updateOne = async (data) => {
  return await GET_DB()
    .collection(USER_MODEL.COLECTION_USER_NAME)
    .findOneAndUpdate(
      { email: data.email },
      {
        $set: {
          password: data.password,
          verifyToken: null,
          expiredVerifyTokenAt: null
        },
      },
      {
        returnDocument: "after",
      }
    );
};

const updateById = async ({ _id, data, options = {} }) => {
  const result = await GET_DB()
    .collection(USER_MODEL.COLECTION_USER_NAME)
    .findOneAndUpdate(
      { _id: new ObjectId(_id) },
      { $set: data },
      { ...options, returnDocument: "after" },
    );

  return result;
};

//Chỉ dùng cho viêc restart server
const updateMany = async (filter = {}, data = {}, options = {}) => {
  const { lastSeenAt, ...restData } = data;

  return await GET_DB()
    .collection(USER_MODEL.COLECTION_USER_NAME)
    .updateMany(
      filter,
      [
        {
          $set: {
            ...restData,
            lastSeenAt: {
              $ifNull: ["$lastSeenAt", lastSeenAt],
            },
            updatedAt: new Date(),
          },
        },
      ],
      options
    );
};

//ADMIN
const findDataUser = async ({
  query = {},
  page = 1,
  limit = 10,
  sort = { createdAt: -1 }
}) => {
  const skip = (Math.max(1, page) - 1) * Number(limit);
  const parsedLimit = Number(limit);

  const { search, ...otherFilters } = query;
  const finalQuery = { ...otherFilters };

  if (search && String(search).trim() !== '') {
    const keyword = String(search).trim();
    const formatKeywords = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const searchRegex = new RegExp(formatKeywords, 'i');

    finalQuery.$or = [
      { fullname: searchRegex },
      { username: searchRegex },
      { email: searchRegex }
    ];
  }

  const pipeline = [
    { $match: finalQuery },
    { $sort: sort },
    { $skip: skip },
    { $limit: parsedLimit },
    {
      $lookup: {
        from: USER_MODEL.COLECTION_USER_NAME,
        let: { creatorId: '$createdBy' },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: ['$_id', { $toObjectId: '$$creatorId' }]
              }
            }
          },
          {
            $project: {
              _id: 1,
              fullname: 1,
              username: 1,
              email: 1,
              avatar: 1
            }
          }
        ],
        as: 'createdByUser'
      }
    },
    {
      $unwind: {
        path: '$createdByUser',
        preserveNullAndEmptyArrays: true
      }
    },
    //Info bannedBy
    {
      $lookup: {
        from: USER_MODEL.COLECTION_USER_NAME,
        let: { banId: '$bannedBy' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $ne: ['$$banId', null] },
                  { $eq: ['$_id', { $toObjectId: '$$banId' }] }
                ]
              }
            }
          },
          {
            $project: {
              _id: 1,
              fullname: 1,
              username: 1,
              email: 1,
              avatar: 1
            }
          }
        ],
        as: 'bannedByInfo'
      }
    },
    {
      $unwind: {
        path: '$bannedByInfo',
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $project: {
        password: 0,
        verifyToken: 0,
        expiredVerifyTokenAt: 0,
        codeReset: 0,
        expiredCodeResetAt: 0,
        showOnlineStatus: 0
      }
    }
  ];

  const [users, totalUsers] = await Promise.all([
    GET_DB()
      .collection(USER_MODEL.COLECTION_USER_NAME)
      .aggregate(pipeline)
      .toArray(),
    GET_DB()
      .collection(USER_MODEL.COLECTION_USER_NAME)
      .countDocuments(finalQuery)
  ]);

  return {
    data: users.map(user => {
      return {
        ...user,
        isOnline: isUserOnline(user._id),
      }
    }),
    pagination: {
      total: totalUsers,
      totalPages: Math.ceil(totalUsers / limit),
      page: Number(page),
      limit: Number(limit),
    }
  };
}

const countData = async ({ filters = {} }) => {
  return await GET_DB()
    .collection(USER_MODEL.COLECTION_USER_NAME)
    .countDocuments(filters)
}

export const USER_REPOSITORY = {
  createOne,
  findById,
  findByEmail,
  activeAcount,
  updateOne,
  updateById,
  findByUser,
  findByToken,
  updateMany,
  findDataUser,
  findByUsername,
  countData
};
