import { GET_DB } from "../config/database.js";
import { MESSAGE_MODEL } from "../models/message.model.js";

const COLLECTION_NAME = MESSAGE_MODEL.COLLECTION_MESSAGE_NAME;

const buildMessagePipeline = ({
  match,
  sort = null,
  skip = null,
  limit = null,
}) => {
  const pipeline = [
    {
      $match: match,
    },
  ];

  if (sort) {
    pipeline.push({
      $sort: sort,
    });
  }

  if (skip !== null) {
    pipeline.push({
      $skip: skip,
    });
  }

  if (limit !== null) {
    pipeline.push({
      $limit: limit,
    });
  }

  pipeline.push(
    {
      $lookup: {
        from: "messageDeliveries",
        let: {
          messageIdStr: { $toString: "$_id" },
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: ["$messageId", "$$messageIdStr"],
              },
            },
          },
        ],
        as: "deliveries",
      },
    },
    {
      $addFields: {
        id: {
          $toString: "$_id",
        },
        status: {
          $cond: [
            {
              $gt: [
                {
                  $size: {
                    $filter: {
                      input: "$deliveries",
                      as: "delivery",
                      cond: {
                        $ne: ["$$delivery.readAt", null],
                      },
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
                          cond: {
                            $ne: ["$$delivery.deliveredAt", null],
                          },
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
        deliveries: {
          $map: {
            input: "$deliveries",
            as: "delivery",
            in: {
              id: {
                $toString: "$$delivery._id",
              },
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
        fileUrl: 1,
        fileName: 1,
        fileSize: 1,
        replyToMessageId: 1,
        isEdited: 1,
        editedAt: 1,
        isDeleted: 1,
        deletedAt: 1,
        createdAt: 1,
        updatedAt: 1,
        deliveries: 1,
        status: 1,
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
  conversationId,
  { limit = 30, skip = 0, sort = { createdAt: 1 }, session = null } = {}
) => {
  const options = session ? { session } : undefined;

  const pipeline = buildMessagePipeline({
    match: {
      conversationId,
      isDeleted: false,
    },
    sort,
    skip,
    limit,
  });

  return await GET_DB()
    .collection(COLLECTION_NAME)
    .aggregate(pipeline, options)
    .toArray();
};

const findMessageAfterSend = async (messageId, session = null) => {
  const options = session ? { session } : undefined;

  const _id =
    typeof messageId === "string" ? new ObjectId(messageId) : messageId;

  const pipeline = buildMessagePipeline({
    match: {
      _id,
      isDeleted: false,
    },
  });

  const result = await GET_DB()
    .collection(COLLECTION_NAME)
    .aggregate(pipeline, options)
    .toArray();

  return result[0] || null;
};

export const MESSAGE_REPOSITORY = {
  createOne,
  findByConversationId,
  findMessageAfterSend
};
