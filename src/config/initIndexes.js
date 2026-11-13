import { GET_DB } from "./database.js";

export const createDatabaseIndexes = async () => {
  const db = GET_DB();
  console.log('--- Đang khởi tạo Database Indexes ---');

  const indexDefinitions = [
    {
      collection: 'users',
      indexes: [
        { key: { email: 1 }, unique: true },
        { 
          key: { username: 1 }, 
          unique: true, 
          partialFilterExpression: { username: { $type: 'string' } } // sẽ khong báo lỗi nếu null
        },
        { 
          key: { verifyToken: 1 }, 
          partialFilterExpression: { verifyToken: { $type: 'string' } } 
        },
        { key: { isBanned: 1, isActive: 1, createdAt: -1 } },
        { key: { fullname: 'text', email: 'text', username: 'text' }, name: 'user_search_text_idx' },
      ],
    },
    {
      collection: 'deviceSession',
      indexes: [
        { key: { sessionId: 1 }, unique: true },
        { key: { refreshToken: 1 }, unique: true },
        { key: { userId: 1, revokedAt: 1, expiredAt: 1 } },
        { key: { expiredAt: 1 }, expireAfterSeconds: 0 },
      ],
    },
    {
      collection: 'contacts',
      indexes: [
        { key: { ownerId: 1, contactUserId: 1 }, unique: true },
        { key: { contactUserId: 1 } },
      ],
    },
    {
      collection: 'invitations',
      indexes: [
        { key: { receiverId: 1, status: 1, deleteAt: 1, createdAt: -1 } },
        { key: { senderId: 1, status: 1, deleteAt: 1, createdAt: -1 } },
        { key: { senderId: 1, receiverId: 1, status: 1 } },
        { key: { receiverId: 1, senderId: 1, status: 1 } },
      ],
    },
    {
      collection: 'blocks',
      indexes: [
        { key: { blockerId: 1, blockedId: 1 }, unique: true },
        { key: { blockedId: 1, blockerId: 1, status: 1 } },
      ],
    },
    {
      collection: 'conversations',
      indexes: [
        { key: { type: 1, status: 1, lastMessageAt: -1, createdAt: -1 } },
        { key: { 'pinnedMessages.messageId': 1 }, sparse: true },
      ],
    },
    {
      collection: 'conversationParticipants',
      indexes: [
        { key: { conversationId: 1, userId: 1 }, unique: true },
        { key: { userId: 1, leftAt: 1, conversationId: 1 } },
        { key: { conversationId: 1, leftAt: 1 } },
      ],
    },
    {
      collection: 'messages',
      indexes: [
        { key: { conversationId: 1, createdAt: -1 } },
        { key: { conversationId: 1, type: 1, isRevoked: 1, createdAt: -1 } },
        { key: { senderId: 1, type: 1, isRevoked: 1, createdAt: -1 } },
        { key: { 'attachments.tempAttachmentId': 1 }, sparse: true },
        { key: { 'callInfo.callId': 1 }, sparse: true },
        { key: { conversationId: 1, content: 'text' }, name: 'message_content_text_idx' },
      ],
    },
    {
      collection: 'messageDeliveries',
      indexes: [
        { key: { messageId: 1, userId: 1 }, unique: true },
        { key: { userId: 1, conversationId: 1, readAt: 1 } },
        { key: { userId: 1, deliveredAt: 1, readAt: 1 } },
      ],
    },
    {
      collection: 'messageReactions',
      indexes: [
        { key: { messageId: 1, userId: 1 }, unique: true },
        { key: { messageId: 1, createdAt: 1 } },
      ],
    },
    {
      collection: 'calls',
      indexes: [
        { key: { 'participants.userId': 1, status: 1 } },
        { key: { conversationId: 1, createdAt: -1 } },
        { key: { createdAt: -1 } },
        { key: { isVectorStatus: 1, retryCount: 1, updatedAt: 1 }, sparse: true },
      ],
    },
    {
      collection: 'tickets',
      indexes: [
        { key: { reporterId: 1, targetUserId: 1, targetType: 1, createdAt: -1 } },
        { key: { targetType: 1, reporterId: 1, messageId: 1, status: 1 }, sparse: true },
        { key: { reporterId: 1, createdAt: -1 } },
        { key: { status: 1, createdAt: -1 } },
        { key: { targetUserId: 1 } },
      ],
    },
  ];

  for (const { collection, indexes } of indexDefinitions) {
    try {
      await db.collection(collection).createIndexes(indexes);
      console.log(`[Index] Khởi tạo thành công cho collection: ${collection}`);
    } catch (error) {
      console.error(`[Index] Lỗi khởi tạo cho collection ${collection}:`, error.message);
    }
  }

  console.log('--- Hoàn tất khởi tạo Database Indexes ---');
};