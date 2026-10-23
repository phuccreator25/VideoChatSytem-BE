import { GET_DB } from "../config/database.js";
import { TICKET_MODEL } from "../models/ticket.model.js";
import { USER_MODEL } from "../models/user.model.js";
import { reportStatuses } from "../data/ticket.data.js";

const COLLECTION_REPORT_NAME = TICKET_MODEL.COLLECTION_REPORT_NAME;

const createOne = async (data) => {
    const validData = await TICKET_MODEL.validateData(data)
    return await GET_DB().collection(COLLECTION_REPORT_NAME).insertOne(validData)
}

const findOne = async ({ filters = {}, options = {} }) => {
    return await GET_DB().collection(COLLECTION_REPORT_NAME).findOne(filters, options)
}

const updateOne = async (filter = {}, updateData = {}, options = {}) => {
    return await GET_DB().collection(COLLECTION_REPORT_NAME).updateOne(filter, updateData, options)
}

const deleteOne = async (filter = {}, options = {}) => {
  return await GET_DB().collection(COLLECTION_REPORT_NAME).deleteOne(filter, options)
}

const findManyByClient = async ({ filters = {}, page = 1, limit = 10 }) => {
  const { search, targetType, status, currentUserId } = filters;

  if (!currentUserId) {
    throw new Error('Current user ID is required');
  }

  const pageNum = Math.max(1, Number(page));
  const parsedLimit = Math.max(1, Number(limit)) || 10;
  const skip = (pageNum - 1) * parsedLimit;

  const matchTickets = {
    reporterId: String(currentUserId),
  };

  if (status && status !== 'all') matchTickets.status = status;
  if (targetType && targetType !== 'all') matchTickets.targetType = targetType;

  if (search && String(search).trim() !== '') {
    const keyword = String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const searchRegex = new RegExp(keyword, 'i');
    const emailRegex = new RegExp(`^[^@]*${keyword}`, 'i');

    const matchedUsers = await GET_DB().collection(USER_MODEL.COLECTION_USER_NAME)
      .find(
        { $or: [{ fullname: searchRegex }, { email: emailRegex }] },
        { projection: { _id: 1 } }
      )
      .toArray();

    const matchedUserIds = matchedUsers.map((u) => u._id.toString());

    matchTickets.$or = [
      { targetUserId: { $in: matchedUserIds } },
      { reason: searchRegex },
      { description: searchRegex },
    ];
  }

  const pipeline = [
    { $match: matchTickets },
    { $sort: { createdAt: -1 } }, 
    { $facet: {
        data: [
          { $skip: skip },
          { $limit: parsedLimit },
          {
            $lookup: {
              from: USER_MODEL.COLECTION_USER_NAME,
              let: { userId: '$targetUserId' },
              pipeline: [
                {
                  $match: {
                    $expr: {$eq: [{ $toString: '$_id' }, { $toString: '$$userId' }],
                    },
                  },
                },
                { $project: { fullname: 1, avatar: 1, email: 1, username: 1 } },
              ],
              as: 'userData',
            },
          },
          {
            $project: {
              _id: 0,
              id: { $toString: '$_id' },
              targetType: 1,
              status: 1,
              createdAt: 1,
              assignedAt: 1,
              resolvedAt: 1,
              targetUser: {
                id: '$targetUserId',
                fullname: { $ifNull: [{ $arrayElemAt: ['$userData.fullname', 0] }, ''] },
                email: { $ifNull: [{ $arrayElemAt: ['$userData.email', 0] }, ''] },
                avatar: { $ifNull: [{ $arrayElemAt: ['$userData.avatar', 0] }, ''] },
              },
              conversationId: 1,
              messageId: 1,
              reportedMessageSnapshot: 1,
              evidenceAttachments: 1,
              reason: 1,
              description: 1,
              resolutionActions: { $ifNull: ['$resolutionActions', []] },
              unBannedAt: 1,
              feedbackToReporter: 1,
            },
          },
        ],
        totalTicket: [{ $count: 'count' }],
      },
    },
  ];

  const [result] = await GET_DB()
    .collection(TICKET_MODEL.COLLECTION_REPORT_NAME)
    .aggregate(pipeline)
    .toArray();

  const tickets = result?.data || [];
  const total = result?.totalTicket?.[0]?.count || 0;

  return {
    tickets,
    pagination: {
      page: pageNum,
      limit: parsedLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / parsedLimit)),
    },
  };
};

const findManyByAdmin = async ({filters = {}, page = 1, limit = 10}) => {
  try {
    const { targetType, status, reason, search } = filters;

    const pageNum = Math.max(1, Number(page));
    const parsedLimit = Math.max(1, Number(limit)) || 10;
    const skip = (pageNum - 1) * parsedLimit;

    const matchTickets = {}

    if (status && status !== 'all') matchTickets.status = status;
    if (targetType && targetType !== 'all') matchTickets.targetType = targetType;
    if (reason && reason !== 'all') matchTickets.reason = reason;

    if (search && String(search).trim() !== '') {
      const keyword = String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(keyword, 'i');
      const emailRegex = new RegExp(`^[^@]*${keyword}`, 'i');

      const matchedUsers = await GET_DB().collection(USER_MODEL.COLECTION_USER_NAME)
        .find(
          { $or: [{ fullname: searchRegex }, { email: emailRegex }] },
          { projection: { _id: 1 } }
        )
        .toArray();

      const matchedUserIds = matchedUsers.map((u) => u._id.toString());

      matchTickets.$or = [
        { targetUserId: { $in: matchedUserIds } },
        { reason: searchRegex },
        { description: searchRegex },
      ];
    }

    const pipeline = [
    { $match: matchTickets },
    { $sort: { createdAt: -1 } }, 
    { $facet: {
        data: [
          { $skip: skip },
          { $limit: parsedLimit },
          {
            $lookup: {
              from: USER_MODEL.COLECTION_USER_NAME,
              let: { userId: '$targetUserId' },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $eq: [{ $toString: '$_id' }, { $toString: '$$userId' }],
                    },
                  },
                },
                { $project: { fullname: 1, avatar: 1, email: 1, username: 1 } },
              ],
              as: 'userData',
            },
          },
          {
            $lookup: {
              from: USER_MODEL.COLECTION_USER_NAME,
              let: { repId: '$reporterId' },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $eq: [{ $toString: '$_id' }, { $toString: '$$repId' }],
                    },
                  },
                },
                { $project: { fullname: 1, email: 1, username: 1 } },
              ],
              as: 'reporterData',
            },
          },
          {
            $lookup: {
              from: USER_MODEL.COLECTION_USER_NAME,
              let: { adminId: '$assignedTo' },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $eq: [{ $toString: '$_id' }, { $toString: '$$adminId' }],
                    },
                  },
                },
                { $project: { fullname: 1 } },
              ],
              as: 'adminData',
            },
          },
          {
            $project: {
              _id: 0,
              id: { $toString: '$_id' },
              targetType: 1,
              status: 1,
              createdAt: 1,
              assignedAt: 1,
              resolvedAt: 1,
              reporterId: 1,
              reporterName: {
                $ifNull: [{ $arrayElemAt: ['$reporterData.fullname', 0] }, ''],
              },
              reporterNote: { $ifNull: ['$description', ''] },
              targetUser: {
                id: '$targetUserId',
                fullName: { $ifNull: [{ $arrayElemAt: ['$userData.fullname', 0] }, ''] },
                username: { $ifNull: [{ $arrayElemAt: ['$userData.username', 0] }, ''] },
                email: { $ifNull: [{ $arrayElemAt: ['$userData.email', 0] }, ''] },
                avatar: { $ifNull: [{ $arrayElemAt: ['$userData.avatar', 0] }, ''] },
              },
              reason: 1,
              conversationId: 1,
              messageId: 1,
              reportedMessageSnapshot: 1,
              messageSnapshot: {
                $cond: {
                  if: { $eq: ['$targetType', 'message'] },
                  then: {
                    messageId: '$messageId',
                    conversationId: '$conversationId',
                    content: { $ifNull: ['$reportedMessageSnapshot.content', ''] },
                    mediaUrl: '$reportedMessageSnapshot.mediaUrl',
                    sentAt: '$reportedMessageSnapshot.sentAt',
                  },
                  else: null,
                },
              },
              evidenceAttachments: { $ifNull: ['$evidenceAttachments', []] },
              assignedTo: {
                $cond: {
                  if: {
                    $and: [
                      { $ne: ['$assignedTo', null] },
                      { $ne: ['$assignedTo', ''] },
                    ],
                  },
                  then: {
                    id: '$assignedTo',
                    name: { $ifNull: [{ $arrayElemAt: ['$adminData.fullname', 0] }, '$assignedTo'] },
                    assignedAt: '$assignedAt',
                  },
                  else: null,
                },
              },
              resolutionActions: { $ifNull: ['$resolutionActions', []] },
              unBannedAt: 1,
              feedbackToReporter: { $ifNull: ['$feedbackToReporter', ''] },
              adminNotes: { $ifNull: ['$adminNotes', ''] },
            },
          },
        ],
        totalTicket: [{ $count: 'count' }],
      },
    },
  ];

  const [result] = await GET_DB()
    .collection(TICKET_MODEL.COLLECTION_REPORT_NAME)
    .aggregate(pipeline)
    .toArray();

  const tickets = result?.data || [];
  const total = result?.totalTicket?.[0]?.count || 0;

  return {
    reports: tickets,
    tickets,
    pagination: {
      page: pageNum,
      limit: parsedLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / parsedLimit)),
    },
  };

  } catch (error) {
    throw error
  }
}

const countKPIs = async () => {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [result] = await GET_DB()
      .collection(COLLECTION_REPORT_NAME)
      .aggregate([
        {
          $group: {
            _id: null,
            pendingCount: {
              $sum: { $cond: [{ $eq: ["$status", reportStatuses.PENDING] }, 1, 0] },
            },
            inProgressCount: {
              $sum: { $cond: [{ $eq: ["$status", reportStatuses.IN_PROGRESS] }, 1, 0] },
            },
            resolvedTodayCount: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ["$status", reportStatuses.RESOLVED] },
                      { $gte: ["$resolvedAt", startOfToday] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            rejectedCount: {
              $sum: { $cond: [{ $eq: ["$status", reportStatuses.REJECTED] }, 1, 0] },
            },
            totalCount: { $sum: 1 },
          },
        },
      ])
      .toArray();

    return {
      pendingCount: result?.pendingCount || 0,
      inProgressCount: result?.inProgressCount || 0,
      resolvedTodayCount: result?.resolvedTodayCount || 0,
      rejectedCount: result?.rejectedCount || 0,
      totalCount: result?.totalCount || 0,
    };
  } catch (error) {
    throw error;
  }
};

export const TICKET_REPOSITORY = {
  COLLECTION_REPORT_NAME,
  createOne,
  findOne,
  updateOne,
  findManyByClient,
  deleteOne,
  findManyByAdmin,
  countKPIs,
};