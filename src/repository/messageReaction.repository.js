import { ObjectId } from "mongodb";
import { GET_DB } from "../config/database.js";
import { MESSAGE_REACTION_MODEL } from "../models/messageReaction.model.js";

const findOne = async (filters, session = null) => {
  return await GET_DB().collection(MESSAGE_REACTION_MODEL.COLLECTION_MESSAGE_REACTION_NAME)
    .findOne(filters, session)
}

const createOne = async (data, session = null) => {
  const dataValidate = await MESSAGE_REACTION_MODEL.validateData(data);
  return await GET_DB().collection(MESSAGE_REACTION_MODEL.COLLECTION_MESSAGE_REACTION_NAME)
    .insertOne(dataValidate, { session });
}

const updateOne = async (filters, updatedData, session = null) => {
  const options = {
    returnDocument: 'after',
    upsert: true,
  };

  if (session) {
    options.session = session;
  }

  return await GET_DB()
    .collection(MESSAGE_REACTION_MODEL.COLLECTION_MESSAGE_REACTION_NAME)
    .findOneAndUpdate(
      filters,
      {
        $set: updatedData,
      },
      options
    );
};

const findMany = async (filters = {}) => {
  return await GET_DB()
    .collection(MESSAGE_REACTION_MODEL.COLLECTION_MESSAGE_REACTION_NAME)
    .find(filters)
    .toArray();
};

const findByMessageWithUserName = async ({ messageId, currentUserId }) => {
  const msgIdStr = String(messageId);
  const currentUserIdStr = String(currentUserId);

  return GET_DB()
    .collection(MESSAGE_REACTION_MODEL.COLLECTION_MESSAGE_REACTION_NAME)
    .aggregate(
      [
        {
          $match: {
            messageId: msgIdStr,
          },
        },
        // ── LOOKUP USER (Lấy thông tin gốc) ──
        {
          $lookup: {
            from: "users",
            let: { reactionUserId: "$userId" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: ["$_id", { $toObjectId: "$$reactionUserId" }],
                  },
                },
              },
            ],
            as: "user",
          },
        },
        {
          $unwind: {
            path: "$user",
            preserveNullAndEmptyArrays: true,
          },
        },
        // ── LOOKUP CONTACT (Dựa theo Owner là Current User) ──
        {
          $lookup: {
            from: "contacts",
            let: { reactionUserId: "$userId" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      // Khớp chủ sở hữu là người dùng hiện tại (dùng biến toàn cục $$currentUserId)
                      { $eq: [{ $toString: "$ownerId" }, "$$currentUserId"] },
                      // Khớp người trong danh bạ là người thả reaction
                      { $eq: [{ $toString: "$contactUserId" }, { $toString: "$$reactionUserId" }] },
                    ],
                  },
                },
              },
              { $limit: 1 },
            ],
            as: "contact",
          },
        },
        {
          $unwind: {
            path: "$contact",
            preserveNullAndEmptyArrays: true,
          },
        },
        // ── PROJECT (Xử lý hiển thị Tên) ──
        {
          $project: {
            _id: 0,
            userId: { $toString: "$userId" },
            name: {
              $cond: [
                // Nếu người thả reaction chính là tôi -> Hiển thị "You"
                { $eq: ["$userId", "$$currentUserId"] },
                "You",
                {
                  $cond: [
                    // Nếu tôi có đặt Nickname cho người này -> Hiển thị Nickname tôi đặt
                    {
                      $and: [
                        { $ifNull: ["$contact.nickname", false] },
                        { $ne: [{ $trim: { input: "$contact.nickname" } }, ""] }
                      ]
                    },
                    "$contact.nickname",
                    // Nếu không có nickname -> Trả về fullname gốc của họ
                    { $ifNull: ["$user.fullname", "Unknown user"] },
                  ],
                },
              ],
            },
            emotion: 1,
            // Sửa field cho khớp với FE của bạn (đổi sang createAt theo Popover)
            createAt: 1
          },
        },
        {
          $sort: { createAt: 1 },
        },
      ],
      {
        // Khai báo biến môi trường cho Aggregate để tầng dưới hiểu $$currentUserId
        let: { currentUserId: currentUserIdStr },
      }
    )
    .toArray();
};

const deleteOne = async (filters, session = null) => {
  return await GET_DB().collection(MESSAGE_REACTION_MODEL.COLLECTION_MESSAGE_REACTION_NAME)
    .deleteOne(filters, session);
}

export const MESSAGE_REACTION_REPOSITORY = {
  findOne, createOne, updateOne, findMany, findByMessageWithUserName, deleteOne
}