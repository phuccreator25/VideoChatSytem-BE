import { GET_DB } from "../config/database.js";
import { MESSAGE_DELIVERY_MODEL } from "../models/messageDeliveries.model.js";
import { MESSAGE_MODEL } from "../models/message.model.js";

const createOne = async (data, session = null) => {
  const validData = await MESSAGE_DELIVERY_MODEL.validateData(data);

  const options = session ? { session } : {};

  return GET_DB()
    .collection(MESSAGE_DELIVERY_MODEL.COLLECTION_MESSAGE_DELIVERY_NAME)
    .insertOne(validData, options);
};

const findOne = async(filter={}) => {
  return await GET_DB()
              .collection(MESSAGE_DELIVERY_MODEL.COLLECTION_MESSAGE_DELIVERY_NAME)
              .findOne(filter)

}

const findAndUpdateMany = async (
  userId,
  deliveredAt = new Date(),
  session = null
) => {
  const options = session ? { session } : undefined;

  const deliveries = await GET_DB()
    .collection(MESSAGE_DELIVERY_MODEL.COLLECTION_MESSAGE_DELIVERY_NAME)
    .aggregate(
      [
        {
          $match: {
            userId,
            deliveredAt: null,
            readAt: null,
          },
        },
        {
          $lookup: {
            from: MESSAGE_MODEL.COLLECTION_MESSAGE_NAME,
            let: {
              messageObjectId: {
                $convert: {
                  input: "$messageId",
                  to: "objectId",
                  onError: null,
                  onNull: null,
                },
              },
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: ["$_id", "$$messageObjectId"],
                  },
                },
              },
              {
                $project: {
                  _id: 1,
                  senderId: 1,
                  conversationId: 1,
                },
              },
            ],
            as: "message",
          },
        },
        {
          $addFields: {
            senderId: {
              $arrayElemAt: ["$message.senderId", 0],
            },
            conversationId: {
              $arrayElemAt: ["$message.conversationId", 0],
            },
          },
        },
        {
          $project: {
            message: 0,
          },
        },
      ],
      options
    )
    .toArray();

  if (!deliveries.length) {
    return [];
  }

  await GET_DB()
    .collection(MESSAGE_DELIVERY_MODEL.COLLECTION_MESSAGE_DELIVERY_NAME)
    .updateMany(
      {
        _id: {
          $in: deliveries.map((item) => item._id),
        },
      },
      {
        $set: {
          deliveredAt,
          updatedAt: deliveredAt,
        },
      },
      options
    );

  return deliveries.map((item) => ({
    ...item,
    deliveredAt,
    updatedAt: deliveredAt,
  }));
};

const findMessageAndUpdateRead = async(filter = {}, session = null) => {
  const { conversationId, currentUserId } = filter;

  if (!conversationId || !currentUserId) {
    return [];
  }

  const readAt = new Date();
  const options = session ? { session } : undefined;

  const deliveries = await GET_DB()
    .collection(MESSAGE_DELIVERY_MODEL.COLLECTION_MESSAGE_DELIVERY_NAME)
    .aggregate(
      [
        {
          $match: {
            userId: currentUserId,
            readAt: null,
            conversationId
          },
        },
        {
          $lookup: {
            from: MESSAGE_MODEL.COLLECTION_MESSAGE_NAME,
            let: {
              messageObjectId: {
                $convert: {
                  input: "$messageId",
                  to: "objectId",
                  onError: null,
                  onNull: null,
                },
              },
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$_id", "$$messageObjectId"] },
                      { $eq: ["$conversationId", conversationId] },
                      { $eq: ["$isDeleted", false] },
                    ],
                  },
                },
              },
              {
                $project: {
                  _id: 1,
                  senderId: 1,
                },
              },
            ],
            as: "message",
          },
        },
        {
          $match: {
            message: { $ne: [] },
          },
        },
        {
          $addFields: {
            senderId: {
              $arrayElemAt: ["$message.senderId", 0],
            },
          },
        },
        {
          $project: {
            message: 0,
          },
        },
      ],
      options
    )
    .toArray();

  if (!deliveries.length) {
    return [];
  }

  const deliveryIds = deliveries.map((item) => item._id);

  await GET_DB()
    .collection(MESSAGE_DELIVERY_MODEL.COLLECTION_MESSAGE_DELIVERY_NAME)
    .updateMany(
      {
        _id: { $in: deliveryIds },
      },
      [
        {
          $set: {
            readAt,
            deliveredAt: {
              $ifNull: ["$deliveredAt", readAt],
            },
            updatedAt: readAt,
          },
        },
      ],
      options
    );

  return deliveries.map((item) => ({
    ...item,
    deliveredAt: item.deliveredAt || readAt,
    readAt,
    updatedAt: readAt,
  }));
}

export const MESSAGE_DELIVERY_REPOSITORY = {
    createOne, findOne, findAndUpdateMany, findMessageAndUpdateRead
}
