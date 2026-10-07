import { GET_DB } from "../config/database.js";
import { CALL_MODEL } from "../models/call.model.js";
import { USER_MODEL } from "../models/user.model.js";

const createOne = async (data, session = null) => {
    const dataValid = await CALL_MODEL.validateData(data);

    return await GET_DB()
        .collection(CALL_MODEL.COLLECTION_CALL_NAME)
        .insertOne(dataValid, { session });
}

const updateOne = async (filter, updateData, session = null) => {
    return await GET_DB()
        .collection(CALL_MODEL.COLLECTION_CALL_NAME)
        .updateOne(filter, updateData, { session });
}

const findOne = async (filter, session = null) => {
    return await GET_DB()
        .collection(CALL_MODEL.COLLECTION_CALL_NAME)
        .findOne(filter, { session });
}

const updateMany = async (filter, updateData, session = null) => {
    return await GET_DB()
        .collection(CALL_MODEL.COLLECTION_CALL_NAME)
        .updateMany(filter, updateData, { session });
}

const findMany = async (filter, session = null) => {
    return await GET_DB()
        .collection(CALL_MODEL.COLLECTION_CALL_NAME)
        .find(filter, { session })
        .toArray();
}


const findCallsByAdmin = async ({ filters = {}, page = 1, limit = 10 }) => {
  try {
    const pageNum = Math.max(1, Number(page));
    const parsedLimit = Number(limit);
    const skip = (pageNum - 1) * parsedLimit;

    const { search, status, type, endReason, startDate, endDate } = filters;

    const matchCall = {};
    if (status && status !== 'all') matchCall.status = status;
    if (type && type !== 'all') matchCall.type = type;
    if (endReason && endReason !== 'all') matchCall.endReason = endReason;

    if (startDate || endDate) {
      matchCall.createdAt = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setUTCHours(0, 0, 0, 0); 
        matchCall.createdAt.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setUTCHours(23, 59, 59, 999); 
        matchCall.createdAt.$lte = end;
      }
    }

    let calls = [];
    let total = 0;

    // có search: tìm users trước rồi match
    if (search && String(search).trim() !== '') {
      const keyword = String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(keyword, 'i');
      const emailRegex = new RegExp(`^[^@]*${keyword}`, 'i');

      const matchedUsers = await GET_DB().collection(USER_MODEL.COLECTION_USER_NAME)
        .find(
          { $or: [{ fullname: searchRegex }, { username: searchRegex }, { email: emailRegex }] },
          { projection: { _id: 1 } }
        )
        .toArray();

      const matchedUserStringIds = matchedUsers.map(u => u._id.toString());
      // Thêm điều kiện: cuộc gọi phải có ít nhất 1 participant nằm trong danh sách user vừa tìm được
      matchCall['participants.userId'] = { $in: matchedUserStringIds };
    }

    // phân trang trước sau đó mới match
    const pipeline = [
      { $match: matchCall },
      { $sort: { createdAt: -1 } },
      {
        $facet: { // Dùng để run song song data và count 
          data: [
            { $skip: skip },
            { $limit: parsedLimit },

            // Lookup thông tin Users tham gia cuộc gọi (Dùng $toObjectId để ăn B-Tree Index)
            {
              $lookup: {
                from: USER_MODEL.COLECTION_USER_NAME,
                let: { pList: '$participants' },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $in: [
                          '$_id',
                          {
                            $map: {
                              input: '$$pList',
                              as: 'p',
                              in: { $toObjectId: '$$p.userId' } // Chuyển chuỗi sang ObjectId để ăn Index
                            }
                          }
                        ]
                      }
                    }
                  },
                  {
                    $project: {
                      _id: { $toString: '$_id' },
                      fullname: 1,
                      email: 1,
                      username: 1,
                      avatar: 1
                    }
                  }
                ],
                as: 'usersData'
              }
            },

            // Merge thông tin profile vào từng item trong participants
            {
              $addFields: {
                participants: {
                  $map: {
                    input: '$participants',
                    as: 'p',
                    in: { // <==> return
                      $mergeObjects: [
                        '$$p',
                        {
                          $let: {
                            vars: {
                              targetUser: {
                                $arrayElemAt: [
                                  {
                                    $filter: {
                                      input: '$usersData',
                                      as: 'user',
                                      cond: { $eq: ['$$user._id', '$$p.userId'] }
                                    }
                                  },
                                  0 // vì nó luôn trả về 1 mảng thóng nhất nên phải lấy [0] trong mảng
                                ]
                              }
                            },
                            in: {
                              fullname: { $ifNull: ['$$targetUser.fullname', 'User'] },
                              email: { $ifNull: ['$$targetUser.email', ''] },
                              username: { $ifNull: ['$$targetUser.username', ''] },
                              avatar: { $ifNull: ['$$targetUser.avatar', ''] }
                            }
                          }
                        }
                      ]
                    }
                  }
                }
              }
            },

            // Format đúng JSON output cho FE
            {
              $project: {
                _id: { $toString: '$_id' },
                conversationId: 1,
                type: 1,
                status: 1,
                duration: { $ifNull: ['$duration', 0] },
                endReason: 1,
                startedAt: 1,
                endedAt: 1,
                createdAt: 1,
                participants: 1,
                timeline: {
                  initiatedAt: '$createdAt',
                  ringingAt: '$createdAt',
                  connectedAt: '$startedAt',
                  endedAt: '$endedAt'
                }
              }
            }
          ],
          totalCount: [{ $count: 'count' }]
        }
      }
    ];

    const result = await GET_DB().collection(CALL_MODEL.COLLECTION_CALL_NAME).aggregate(pipeline).toArray();

    calls = result[0]?.data || [];
    total = result[0]?.totalCount[0]?.count || 0;

    return {
      calls,
      pagination: {
        total,
        totalPages: Math.ceil(total / parsedLimit),
        page: pageNum,
        limit: parsedLimit
      }
    };
  } catch (error) {
    throw error;
  }
};


export const CALL_REPOSITORY = {
    createOne,
    updateOne,
    findOne,
    updateMany,
    findMany,
    findCallsByAdmin
}