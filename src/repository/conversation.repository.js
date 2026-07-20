import { GET_DB } from "../config/database.js";
import { CONVERSATION_MODEL } from "../models/conversation.model.js";
import { CONVERSATION_PARTICIPANT_MODEL } from "../models/conversationParticipant.model.js";
import { CONTACT_MODEL } from "../models/contact.model.js";
import { USER_MODEL } from "../models/user.model.js";
import { MESSAGE_MODEL } from "../models/message.model.js";
import { MESSAGE_DELIVERY_MODEL } from "../models/messageDeliveries.model.js";
import { isUserOnline } from "../sockets/socketStore.js";
import { ObjectId } from "mongodb";

const COLLECTION_NAME = CONVERSATION_MODEL.COLLECTION_CONVERSATION_NAME;
const PARTICIPANT_COLLECTION_NAME =
  CONVERSATION_PARTICIPANT_MODEL.COLLECTION_CONVERSATION_PARTICIPANT_NAME;

const createOne = async (data, session = null) => {
  const validatedData = await CONVERSATION_MODEL.validateData(data);

  const result = await GET_DB()
    .collection(COLLECTION_NAME)
    .insertOne(validatedData, { session });

  return {
    _id: result.insertedId,
    ...validatedData,
  };
};

const findOne = async (filter = {}, session = null) => {
  const options = session ? { session } : undefined;

  const result = await GET_DB()
    .collection(COLLECTION_NAME)
    .findOne(filter, options);

  return result;
};

const findConversationBetweenUser = async (currentUserId, userId) => {
  const userIds = [String(currentUserId), String(userId)];

  const matchedConversation = await GET_DB()
    .collection(CONVERSATION_MODEL.COLLECTION_CONVERSATION_NAME)
    .aggregate([
      {
        $match: {
          type: CONVERSATION_MODEL.conversationTypes.DIRECT,
          status: CONVERSATION_MODEL.conversationStatus.ACTIVE,
        },
      },
      {
        $lookup: {
          from: PARTICIPANT_COLLECTION_NAME,
          let: { conversationIdStr: { $toString: "$_id" } },
          pipeline: [
            {
              $match: {
                leftAt: null,
                $expr: { $eq: ["$conversationId", "$$conversationIdStr"] },
              },
            },
            {
              $project: {
                _id: 0,
                userId: 1,
              },
            },
          ],
          as: "participants",
        },
      },
      {
        $match: {
          $expr: {
            $and: [
              { $eq: [{ $size: "$participants" }, 2] },
              {
                $setEquals: [
                  {
                    $map: {
                      input: "$participants",
                      as: "participant",
                      in: "$$participant.userId",
                    },
                  },
                  userIds,
                ],
              },
            ],
          },
        },
      },
      { $limit: 1 },
    ])
    .next();

  return matchedConversation || null;
};

const updateOne = async (filter = {}, updateData = {}, session = null) => {
  const options = session ? { session } : undefined;

  const result = await GET_DB()
    .collection(COLLECTION_NAME)
    .updateOne(filter, updateData, options);

  return result;
};

const previewByMessage = (message) => {
  if (!message) return "No messages yet";

  if (message.isRevoked) {
    return "This message has been revoked";
  }

  if (message.messageType === "call" || message.type === "call" || message.callInfo) {
    const callInfo = message.callInfo || {};
    const isVideo = callInfo.callType === "video";
    const status = (callInfo.status || "").toLowerCase();

    if (status === "missed") {
      return isVideo ? "Missed video call" : "Missed voice call";
    }
    if (status === "rejected") {
      return isVideo ? "Video call declined" : "Voice call declined";
    }
    if (status === "cancelled") {
      return isVideo ? "Cancelled video call" : "Cancelled voice call";
    }
    return isVideo ? "Video call" : "Voice call";
  }

  if (message.type === "text") {
    const content = message.content?.trim?.();

    return content || "Text message";
  }

  if (message.type === "gif") {
    return "Sent a GIF";
  }

  if (message.type === "typing") {
    return "Typing...";
  }

  if (message.type === "file") {
    const attachment = message.attachments?.[0];

    const resourceType = attachment?.resourceType;
    const mimeType = String(attachment?.mimeType || "");

    if (
      resourceType === "audio" ||
      mimeType.startsWith("audio/")
    ) {
      return "Sent a voice";
    }

    if (
      resourceType === "video" ||
      mimeType.startsWith("video/")
    ) {
      return "Sent a video";
    }

    if (
      resourceType === "image" ||
      mimeType.startsWith("image/")
    ) {
      return "Sent an image";
    }

    return "Sent a file";
  }

  return "New message";
};

const buildInitials = (name = "") => {
  const words = String(name).trim().split(/\s+/).filter(Boolean);

  if (!words.length) return "";

  const first = words[0]?.[0] || "";
  const last = words.length > 1 ? words[words.length - 1]?.[0] || "" : "";

  return `${first}${last}`.toUpperCase();
};

const formatConversationTime = (timeInput) => {
  if (!timeInput) return "";

  const date = new Date(timeInput);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const findListByUserId = async (currentUserId) => {
  if (!currentUserId) return [];

  const conversations = await GET_DB()
    .collection(COLLECTION_NAME)
    .aggregate([
      {
        $match: {
          type: CONVERSATION_MODEL.conversationTypes.DIRECT,
          status: CONVERSATION_MODEL.conversationStatus.ACTIVE,
        },
      },
      {
        $addFields: {
          conversationIdStr: { $toString: "$_id" },
        },
      },
      {
        $lookup: {
          from: PARTICIPANT_COLLECTION_NAME,
          let: { conversationIdStr: "$conversationIdStr" },
          pipeline: [
            {
              $match: {
                leftAt: null,
                $expr: { $eq: ["$conversationId", "$$conversationIdStr"] },
              },
            },
            {
              $project: {
                _id: 0,
                userId: 1,
              },
            },
          ],
          as: "participants",
        },
      },
      {
        $match: {
          "participants.userId": currentUserId,
        },
      },
      {
        $addFields: {
          otherParticipant: {
            $arrayElemAt: [
              {
                $filter: {
                  input: "$participants",
                  as: "participant",
                  cond: { $ne: ["$$participant.userId", currentUserId] },
                },
              },
              0,
            ],
          },
        },
      },
      {
        $match: {
          "otherParticipant.userId": { $exists: true, $ne: null },
        },
      },
      {
        $lookup: {
          from: USER_MODEL.COLECTION_USER_NAME,
          let: { otherUserId: "$otherParticipant.userId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: [
                    "$_id",
                    {
                      $convert: {
                        input: "$$otherUserId",
                        to: "objectId",
                        onError: null,
                        onNull: null,
                      },
                    },
                  ],
                },
              },
            },
            {
              $project: {
                _id: 1,
                fullname: 1,
                avatar: 1,
                status: 1,
              },
            },
          ],
          as: "otherUser",
        },
      },
      {
        $unwind: {
          path: "$otherUser",
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $lookup: {
          from: CONTACT_MODEL.COLLECTION_CONTACT_NAME,
          let: { otherUserId: "$otherParticipant.userId" },
          pipeline: [
            {
              $match: {
                ownerId: currentUserId,
                $expr: { $eq: ["$contactUserId", "$$otherUserId"] },
              },
            },
            {
              $project: {
                _id: 0,
                nickname: 1,
              },
            },
            { $limit: 1 },
          ],
          as: "contactInfo",
        },
      },
      {
        $lookup: {
          from: MESSAGE_MODEL.COLLECTION_MESSAGE_NAME,
          let: { conversationIdStr: "$conversationIdStr" }, // Xử lý last message  nếu  bị delete for me
          pipeline: [
            {
              $match: {
                deletedBy: {
                  $nin: [currentUserId], // Nếu message có id của currentUserId trong deletedBy thì sẽ không lấy message đó
                },
                $expr: { $eq: ["$conversationId", "$$conversationIdStr"] },
              },
            },
            {
              $sort: {
                createdAt: -1,
              },
            },
            {
              $project: {
                _id: 1,
                type: 1,
                messageType: 1,
                callInfo: 1,
                content: 1,
                createdAt: 1,
                attachments: 1,
                isRevoked: 1,
              },
            },
            { $limit: 1 },
          ],
          as: "lastMessage",
        },
      },
      {
        $lookup: {
          from: MESSAGE_DELIVERY_MODEL.COLLECTION_MESSAGE_DELIVERY_NAME,
          let: { conversationIdStr: "$conversationIdStr" },
          pipeline: [
            {
              $match: {
                userId: currentUserId,
                readAt: null,
                $expr: { $eq: ["$conversationId", "$$conversationIdStr"] },
              },
            },
            {
              $count: "count",
            },
          ],
          as: "unreadInfo",
        },
      },
      {
        $addFields: {
          nickname: { $arrayElemAt: ["$contactInfo.nickname", 0] },
          lastMessage: { $arrayElemAt: ["$lastMessage", 0] },
          unreadCount: {
            $ifNull: [{ $arrayElemAt: ["$unreadInfo.count", 0] }, 0],
          },
        },
      },
      {
        $project: {
          _id: 0,
          conversationId: "$conversationIdStr",
          displayName: {
            $ifNull: ["$nickname", "$otherUser.fullname"],
          },
          avatar: "$otherUser.avatar",
          userStatus: "$otherUser.status",
          lastMessage: 1,
          lastMessageAt: 1,
          createdAt: 1,
          unreadCount: 1,
          userId: "$otherUser._id",
        },
      },
      {
        $sort: {
          lastMessageAt: -1,
          createdAt: -1,
        },
      },
    ])
    .toArray();

  return conversations.map((item, index) => {
    const displayName = item.displayName || "Unknown";
    const timeSource =
      item.lastMessage?.createdAt || item.lastMessageAt || item.createdAt;

    return {
      id: item.conversationId,
      name: displayName,
      avatar: item.avatar || "",
      initials: buildInitials(displayName),
      status: isUserOnline(item.userId) ? "online" : "offline",
      preview: previewByMessage(item.lastMessage),
      time: formatConversationTime(timeSource),
      type: item.lastMessage?.type === "image" ? "image" : "text",
      unread: item.unreadCount || 0,
      active: false,
      userId: item.userId,
    };
  });
};

const findManyPinMessages = async (conversationId, currentUserId = null, session = null) => {
  const options = session ? { session } : {};

  const pinnedMessages = await GET_DB()
    .collection("conversations")
    .aggregate(
      [
        {
          $match: {
            _id: new ObjectId(conversationId),
            status: "active",
          },
        },

        // Tách từng phần tử trong pinnedMessages
        {
          $unwind: {
            path: "$pinnedMessages",
          },
        },
        {
          $addFields: {
            "pinnedMessages.messageObjectId": {
              $toObjectId: "$pinnedMessages.messageId",
            },
          },
        },
        {
          $lookup: {
            from: "messages",
            localField: "pinnedMessages.messageObjectId",
            foreignField: "_id",
            as: "message",
          },
        },

        {
          $unwind: {
            path: "$message",
          },
        },
        {
          $sort: {
            "pinnedMessages.pinnedAt": -1,
          },
        },
        {
          $project: {
            _id: 0,

            id: "$message._id",
            conversationId: "$message.conversationId",
            senderId: "$message.senderId",
            pinnedBy: "$pinnedMessages.pinnedBy",
            pinnedAt: "$pinnedMessages.pinnedAt",
            type: "$message.type",
            content: {
              $ifNull: ["$message.content", null],
            },
            gifUrl: {
              $ifNull: ["$message.gifUrl", null],
            },
            attachmentId: '$pinnedMessages.attachmentId',
            attachments: {
              $cond: [
                {
                  $or: [
                    { $eq: ["$pinnedMessages.attachmentId", null] },
                    { $eq: ["$pinnedMessages.attachmentId", ""] },
                  ],
                },

                // Pin toàn bộ message
                {
                  $ifNull: ["$message.attachments", []],
                },

                // Pin riêng attachment
                {
                  $filter: {
                    input: {
                      $ifNull: ["$message.attachments", []],
                    },
                    as: "attachment",
                    cond: {
                      $eq: [
                        "$$attachment.attachmentId",
                        "$pinnedMessages.attachmentId",
                      ],
                    },
                  },
                },
              ],
            },
          },
        },
      ],
      options,
    )
    .toArray();

  return pinnedMessages;
};

const deletePinMessage = async (
  conversationId,
  messageId,
  attachmentId = null,
  session = null,
) => {
  return GET_DB()
    .collection(COLLECTION_NAME)
    .updateOne(
      {
        _id: new ObjectId(conversationId),
        status: "active",

        pinnedMessages: {
          $elemMatch: {
            messageId: messageId,
            attachmentId: attachmentId || null,
          },
        },
      },
      {
        $pull: {
          pinnedMessages: {
            messageId: messageId,
            attachmentId: attachmentId || null,
          },
        },

        $set: {
          updatedAt: new Date(),
        },
      },
      session ? { session } : undefined,
    );
};

export const CONVERSATION_REPOSITORY = {
  createOne,
  findOne,
  findConversationBetweenUser,
  updateOne,
  findListByUserId,
  findManyPinMessages,
  deletePinMessage
};
