import { ObjectId } from "mongodb";
import { GET_DB } from "../config/database.js";
import { MESSAGE_MODEL } from "../models/message.model.js";

const COLLECTION_NAME = MESSAGE_MODEL.COLLECTION_MESSAGE_NAME;

//FIX LẠI ĐOẠN NÀY TƯƠNG TỰ Ở MESSAGE REACTION REPO
const buildMessagePipeline = ({
  match,
  sort = null,
  skip = null,
  limit = null,
  currentUserId = null, // Nhận thêm currentUserId từ repo truyền vào
}) => {
  const pipeline = [
    {
      $match: match,
    },
  ];

  if (sort) pipeline.push({ $sort: sort });
  if (skip !== null) pipeline.push({ $skip: skip });
  if (limit !== null) pipeline.push({ $limit: limit });

  const currentUserIdStr = currentUserId ? String(currentUserId) : null;

  // Giữ nguyên lookup gốc của bạn
  pipeline.push(
    {
      $lookup: {
        from: "messageDeliveries",
        let: { messageIdStr: { $toString: "$_id" } },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$messageId", "$$messageIdStr"] },
            },
          },
        ],
        as: "deliveries",
      },
    },
    {
      $lookup: {
        from: "messages",
        let: { replyId: "$replyToMessageId" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $ne: ["$$replyId", null] },
                  { $eq: [{ $toString: "$_id" }, "$$replyId"] },
                ],
              },
            },
          },
          { $addFields: { id: { $toString: "$_id" } } },
          {
            $project: {
              _id: 0,
              id: 1,
              senderId: 1,
              type: 1,
              content: 1,
              gifUrl: 1,
              attachments: 1,
              createdAt: 1,
              isRevoked: 1,
              revokedAt: 1,
            },
          },
        ],
        as: "replyMessageArr",
      },
    },
    {
      $addFields: {
        replyMessage: { $arrayElemAt: ["$replyMessageArr", 0] },
      },
    }
  );

  // --- ĐOẠN THÊM MỚI: LOOKUP EMOTION REACTIONS ---
  // --- ĐOẠN THÊM MỚI: LOOKUP EMOTION REACTIONS ---
  pipeline.push({
    $lookup: {
      from: "messageReactions",
      // SỬA Ở ĐÂY 1: Thêm currentUserId vào let để các pipeline con hiểu được
      let: {
        msgIdStr: { $toString: "$_id" },
        currentUserId: currentUserIdStr
      },
      pipeline: [
        {
          $match: {
            $expr: { $eq: ["$messageId", "$$msgIdStr"] },
          },
        },
        // Lookup sang bảng users để lấy fullname
        {
          $lookup: {
            from: "users",
            let: { reactionUserId: "$userId" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$_id", { $toObjectId: "$$reactionUserId" }] },
                },
              },
            ],
            as: "userDoc",
          },
        },
        { $unwind: { path: "$userDoc", preserveNullAndEmptyArrays: true } },
        // Lookup sang bảng contacts
        {
          $lookup: {
            from: "contacts",
            let: { reactionUserId: "$userId" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      // SỬA Ở ĐÂY 2: Đã dùng đúng biến $$currentUserId (đã được định nghĩa ở let phía trên)
                      { $eq: [{ $toString: "$ownerId" }, "$$currentUserId"] },
                      { $eq: [{ $toString: "$contactUserId" }, { $toString: "$$reactionUserId" }] },
                    ],
                  },
                },
              },
              { $limit: 1 },
            ],
            as: "contactDoc",
          },
        },
        { $unwind: { path: "$contactDoc", preserveNullAndEmptyArrays: true } },
        // Định hình lại output
        {
          $project: {
            _id: 0,
            userId: { $toString: "$userId" }, // Ép kiểu về String để trả về FE cho đồng nhất
            emotion: "$emotion",
            createdAt: 1,
            name: {
              $cond: [
                // SỬA Ở ĐÂY 3: Ép $userId sang chuỗi trước khi so sánh với $$currentUserId (chuỗi) để đảm bảo chính xác 100%
                { $eq: [{ $toString: "$userId" }, "$$currentUserId"] },
                "You",
                {
                  $cond: [
                    {
                      $and: [
                        { $ifNull: ["$contactDoc.nickname", false] },
                        { $ne: [{ $trim: { input: "$contactDoc.nickname" } }, ""] }
                      ]
                    },
                    "$contactDoc.nickname",
                    { $ifNull: ["$userDoc.fullname", "Unknown user"] },
                  ],
                },
              ],
            },
          },
        },
      ],
      as: "reactions",
    },
  });

  // Tái sử dụng tính toán status và ánh xạ mảng cũ của bạn
  pipeline.push(
    {
      $addFields: {
        id: { $toString: "$_id" },
        attachmentCount: { $size: { $ifNull: ["$attachments", []] } },
        hasDoneAttachment: {
          $gt: [
            {
              $size: {
                $filter: {
                  input: { $ifNull: ["$attachments", []] },
                  as: "attachment",
                  cond: { $eq: ["$$attachment.status", "done"] },
                },
              },
            },
            0,
          ],
        },
      },
    },
    {
      $addFields: {
        status: {
          $cond: [
            {
              $and: [
                { $gt: ["$attachmentCount", 0] },
                { $eq: ["$hasDoneAttachment", false] },
              ],
            },
            "sending",
            {
              $cond: [
                {
                  $gt: [
                    {
                      $size: {
                        $filter: {
                          input: "$deliveries",
                          as: "delivery",
                          cond: { $ne: ["$$delivery.readAt", null] },
                        },
                      },
                    },
                    0,
                  ],
                },
                "read",
                {
                  $cond: [
                    {
                      $gt: [
                        {
                          $size: {
                            $filter: {
                              input: "$deliveries",
                              as: "delivery",
                              cond: { $ne: ["$$delivery.deliveredAt", null] },
                            },
                          },
                        },
                        0,
                      ],
                    },
                    "delivered",
                    "sent",
                  ],
                },
              ],
            },
          ],
        },
        deliveries: {
          $map: {
            input: "$deliveries",
            as: "delivery",
            in: {
              id: { $toString: "$$delivery._id" },
              messageId: "$$delivery.messageId",
              userId: "$$delivery.userId",
              deliveredAt: "$$delivery.deliveredAt",
              readAt: "$$delivery.readAt",
            },
          },
        },
      },
    },
    {
      $project: {
        _id: 0,
        id: 1,
        conversationId: 1,
        senderId: 1,
        type: 1,
        content: 1,
        gifUrl: 1,
        attachments: 1,
        fileUrl: 1,
        fileName: 1,
        fileSize: 1,
        replyToMessageId: 1,
        replyMessage: 1,
        isEdited: 1,
        editedAt: 1,
        isRevoked: 1,
        revokedAt: 1,
        deletedAt: 1,
        createdAt: 1,
        updatedAt: 1,
        deliveries: 1,
        status: 1,
        reactions: 1, // ĐƯA THÊM REACTIONS VÀO ĐẦU RA PROJECT
        preview: 1,
        messageType: 1,
        callInfo: 1
      },
    }
  );

  return pipeline;
};

const createOne = async (data, session = null) => {
  const validatedData = await MESSAGE_MODEL.validateData(data);
  const options = session ? { session } : {};

  const result = await GET_DB()
    .collection(COLLECTION_NAME)
    .insertOne(validatedData, options);

  return {
    _id: result.insertedId,
    ...validatedData,
  };
};

const findByConversationId = async (
  conversationId, currentUserId = null,
  { limit = 30, skip = 0, sort = { createdAt: 1 }, session = null } = {},
) => {
  const options = session ? { session } : undefined;

  const match = { conversationId };
  if (currentUserId) {
    match.deletedBy = {
      $nin: [currentUserId],
    };
  }

  const pipeline = buildMessagePipeline({
    match,
    sort,
    skip,
    limit,
    currentUserId,
  });

  return await GET_DB()
    .collection(COLLECTION_NAME)
    .aggregate(pipeline, options)
    .toArray();
};

const findMessageAfterSend = async (messageId, session = null) => {
  const options = session ? { session } : undefined;

  const pipeline = buildMessagePipeline({
    match: {
      _id: new ObjectId(messageId),
    },
  });

  const result = await GET_DB()
    .collection(COLLECTION_NAME)
    .aggregate(pipeline, options)
    .toArray();

  return result[0] || null;
};

const updateAttachmentStatus = async ({
  messageId,
  attachmentId,
  status,
  session = null,
}) => {
  const options = session ? { session } : {};

  return await GET_DB()
    .collection(COLLECTION_NAME)
    .updateOne(
      {
        _id: new ObjectId(messageId),
        "attachments.attachmentId": attachmentId,
      },
      {
        $set: {
          "attachments.$.status": status,
          "attachments.$.updatedAt": new Date(),
          updatedAt: new Date(),
        },
      },
      options,
    );
};

const updateAttachmentAfterUpload = async ({
  messageId,
  attachmentId,
  fileUrl,
  publicId,
  session = null,
}) => {
  const options = session ? { session } : {};

  return await GET_DB()
    .collection(COLLECTION_NAME)
    .updateOne(
      {
        _id: new ObjectId(messageId),
        "attachments.attachmentId": attachmentId,
      },
      {
        $set: {
          "attachments.$.fileUrl": fileUrl,
          "attachments.$.publicId": publicId,
          "attachments.$.status": "done",
          "attachments.$.updatedAt": new Date(),
          updatedAt: new Date(),
        },
      },
      options,
    );
};

const findOne = async (filters = {}, session = null) => {
  return await GET_DB().collection(COLLECTION_NAME)
    .findOne(filters, { session })
}

const updateOne = async (filter = {}, updateData = {}, session = null) => {
  return await GET_DB().collection(COLLECTION_NAME)
    .updateOne(filter, updateData, { session })
}

const searchMessages = async ({ conversationId, keyword, currentUserId, session = null }) => {
  const options = session ? { session } : undefined;

  const match = {
    conversationId,
    content: { $regex: keyword, $options: "i" },
    isRevoked: false,
  };

  if (currentUserId) {
    match.deletedBy = {
      $nin: [currentUserId],
    };
  }

  const pipeline = buildMessagePipeline({
    match,
    sort: { createdAt: 1 },
    currentUserId,
  });

  return await GET_DB()
    .collection(COLLECTION_NAME)
    .aggregate(pipeline, options)
    .toArray();
};

const onGetMoreMessages = async (
  conversationId,
  beforeTimestamp,
  currentUserId,
  limit = 30,
  skip = 0
) => {
  const match = {
    conversationId,
    createdAt: { $lt: new Date(beforeTimestamp) },
    isRevoked: false,
  };

  if (currentUserId) {
    match.deletedBy = { $nin: [currentUserId] };
  }

  const pipeline = buildMessagePipeline({
    match,
    sort: { createdAt: -1 },
    skip,
    limit,
    currentUserId,
  });

  return await GET_DB()
    .collection(COLLECTION_NAME)
    .aggregate(pipeline)
    .toArray();
};

const onGetShareMedia = async (conversationId, limit = 20, skip = 0) => {
  const results = await GET_DB()
    .collection(COLLECTION_NAME)
    .aggregate([
      { $match: { conversationId, isRevoked: false, type: "file" } },
      { $unwind: "$attachments" },
      { $match: { "attachments.resourceType": { $in: ["image", "video"] }, "attachments.status": "done", } },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit }
    ])
    .toArray();

  return results.map((item) => ({
    fileUrl: item.attachments.fileUrl,
    fileName: item.attachments.fileName,
    fileSize: item.attachments.fileSize,
    mimeType: item.attachments.mimeType,
    messageId: item._id,
    conversationId: item.conversationId,
    createdAt: item.createdAt,
  }));
};

const onGetShareFiles = async (conversationId, limit = 20, skip = 0) => {
  const results = await GET_DB()
    .collection(COLLECTION_NAME)
    .aggregate([
      { $match: { conversationId, isRevoked: false, type: "file" } },
      { $unwind: "$attachments" },
      { $match: { "attachments.resourceType": { $nin: ["image", "video"] }, "attachments.status": "done", } },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit }
    ])
    .toArray();

  return results.map((item) => ({
    fileUrl: item.attachments.fileUrl,
    fileName: item.attachments.fileName,
    fileSize: item.attachments.fileSize,
    mimeType: item.attachments.mimeType,
    messageId: item._id,
    conversationId: item.conversationId,
    createdAt: item.createdAt,
  }));
};

const onGetShareLinks = async (conversationId, limit = 20, skip = 0) => {
  const results = await GET_DB()
    .collection(COLLECTION_NAME)
    .find({
      conversationId,
      content: { $regex: /https?:\/\/[^\s]+/ },
      isRevoked: false,
      type: "text"
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .toArray();

  return results.flatMap((item) => {
    const urls = item.content.match(/https?:\/\/[^\s]+/g) || [];
    return urls.map((url, index) => {
      let title = "Web Link";
      let domain = "";
      try {
        const parsedUrl = new URL(url);
        const hostname = parsedUrl.hostname.replace("www.", "");
        domain = hostname;
        title = hostname.charAt(0).toUpperCase() + hostname.slice(1);
      } catch (e) {
        // Fallback if URL parsing fails
      }
      return {
        id: `${item._id}-${index}`,
        url,
        title,
        domain,
        messageId: item._id,
        conversationId: item.conversationId,
        createdAt: item.createdAt,
      };
    });
  });
};

const searchMessagesGlobal = async (keyword, limit = 10) => {
  try {
    const pipeline = buildMessagePipeline({
      match: {
        content: { $regex: keyword, $options: "i" },
        isRevoked: false,
        type: "text",
      },
      sort: { createdAt: -1 },
      limit: limit,
    });

    return await GET_DB()
      .collection(COLLECTION_NAME)
      .aggregate(pipeline)
      .toArray();
  } catch (error) {
    throw error;
  }
};

export const MESSAGE_REPOSITORY = {
  createOne,
  findByConversationId,
  findMessageAfterSend,
  updateAttachmentStatus,
  updateAttachmentAfterUpload,
  findOne,
  updateOne,
  searchMessages,
  onGetMoreMessages,
  onGetShareMedia,
  onGetShareFiles,
  onGetShareLinks,
  searchMessagesGlobal,
};
