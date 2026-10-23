import { ObjectId } from "mongodb";
import { CONVERSATION_REPOSITORY } from "../../repository/conversation.repository.js";
import { MESSAGE_REPOSITORY } from "../../repository/message.repository.js";
import { TICKET_REPOSITORY } from "../../repository/ticket.repository.js";
import { USER_REPOSITORY } from "../../repository/user.repository.js";
import { ACCOUNT_REPORT_COOLDOWN_HOURS, reportStatuses } from "../../data/ticket.data.js";
import { UPLOAD_S3 } from "../../helper/uploadS3.js";

const extractFilenameFromS3Key = (s3Key = "") => {
  if (!s3Key) return "";
  const parts = s3Key.split('/');
  const rawFilename = parts[parts.length - 1]; // Lấy phần tử cuối cùng
  return decodeURIComponent(rawFilename);
};

const createOne = async (payload) => {
    try {
      if(!payload) throw new Error('Payload is required')

        let newTicket = null;
        let evidenceAttachments = [];
        
        if (payload.targetType === 'account') {

          if(!payload.uploadSessionId) throw new Error('Please upload evidence again');

          const targetUser = await USER_REPOSITORY.findById(payload.targetUserId)
          if(!targetUser) throw new Error('Target user not found')

          const latestTicket = await TICKET_REPOSITORY.findOne({
            filters: {
              reporterId: payload.reporterId.toString(),
              targetUserId: payload.targetUserId.toString(),
              targetType: 'account',
            },
            options: { sort: { createdAt: -1 } },
          });

          if (latestTicket) {
            if ([reportStatuses.PENDING, reportStatuses.IN_PROGRESS].includes(latestTicket.status)) {
              throw new Error('Reported account is processing. Please try again later');
            }

            if ([reportStatuses.RESOLVED, reportStatuses.REJECTED].includes(latestTicket.status)) {
              const lastCreatedTime = new Date(latestTicket.createdAt).getTime();
              const now = Date.now();
              const remainHours = (now - lastCreatedTime) / (1000 * 60 * 60);

              if (remainHours < ACCOUNT_REPORT_COOLDOWN_HOURS) {
                const remainingHours = Math.ceil(ACCOUNT_REPORT_COOLDOWN_HOURS - remainHours);
                throw new Error(
                  `You have reported this account recently. Please try again after ${remainingHours} hours.`
                );
              }
            }
          }

          if(payload.evidenceAttachments?.length > 0) {
            await UPLOAD_S3.onMoveFile({
              tempKeys: payload.evidenceAttachments,
              ticketId: payload.uploadSessionId,
            })

            evidenceAttachments = await Promise.all(
                payload.evidenceAttachments.map((item) => {
                  const filename = extractFilenameFromS3Key(item);
                  return UPLOAD_S3.onGetURL(
                    'reports',
                    null,
                    null,
                    filename,
                    payload.uploadSessionId,
                  );
                })
              );
          }

          newTicket = {
            _id: new ObjectId(payload.uploadSessionId),
            reporterId: payload.reporterId,
            targetType: payload.targetType,
            targetUserId: payload.targetUserId,
            reason: payload.reason,
            description: payload.description,
            evidenceAttachments: evidenceAttachments,
            status: reportStatuses.PENDING,
          }
        }

        if(payload.targetType === 'message') {
          const conversation = await CONVERSATION_REPOSITORY.findOne({
            _id: new ObjectId(payload.conversationId)
          })

          if(!conversation) throw new Error('Conversation not found')

          const message = await MESSAGE_REPOSITORY.findOne({
            _id: new ObjectId(payload.messageId)
          })
          if(!message) throw new Error('Message not found')

          if(message.senderId.toString() === payload.reporterId.toString()) throw new Error('You cannot report your own message')

          const isExistTicket = await TICKET_REPOSITORY.findOne({
            filters: {
              targetType: 'message',
              reporterId: payload.reporterId.toString(),
              conversationId: payload.conversationId.toString(),
              messageId: payload.messageId.toString(),
              status: {
                $in: [
                  reportStatuses.PENDING,
                  reportStatuses.IN_PROGRESS,
                  reportStatuses.RESOLVED,
                  reportStatuses.REJECTED,
                ],
              },
            },
          });

          if (isExistTicket) {
            if (isExistTicket.status === reportStatuses.RESOLVED) {
              throw new Error('This message has been resolved. Please contact support for more information.');
            }
            if (isExistTicket.status === reportStatuses.REJECTED) {
              throw new Error('This message has been rejected. Please contact support for more information.');
            }
            throw new Error('This message has been reported. Please wait for the admin to review it.');
          }
          
          newTicket = {
            reporterId: payload.reporterId,
            targetType: 'message',
            targetUserId: payload.targetUserId,
            conversationId: payload.conversationId,
            messageId: payload.messageId,
            reportedMessageSnapshot: payload.reportedMessageSnapshot,
            reason: payload.reason,
            description: payload.description,
            status: reportStatuses.PENDING,
          }
        }

        if (!newTicket) {
          throw new Error('Please try again later');
        }

        const result = await TICKET_REPOSITORY.createOne(newTicket)

        return result
    } catch (error) {
      throw error
    }
};

const onGetData = async({filters = {}, page, limit}) => {
    try {

        if(!filters.currentUserId) throw new Error('Current user is required')

        const tickets = await TICKET_REPOSITORY.findManyByClient({filters, page, limit})

        return tickets
    } catch (error) {
      throw error
    }
}

const onCancel = async (id, currentUserId) => {
  if (!id) throw new Error('Please try again later');
  if (!currentUserId) throw new Error('You are not authorized to perform this action');

  const ticket = await TICKET_REPOSITORY.findOne({
    filters: {
      _id: new ObjectId(id),
      status: reportStatuses.PENDING,
      reporterId: currentUserId.toString()
    }
  });

  if (!ticket) throw new Error('Ticket not found');

  const result = await TICKET_REPOSITORY.deleteOne({ _id: new ObjectId(id) });

  if (ticket.targetType === 'account' && ticket.evidenceAttachments?.length > 0) {
    try {
      await UPLOAD_S3.onDeleteFile({
        ticketId: id,
        evidenceAttachments: ticket.evidenceAttachments,
      });
    } catch (s3Error) {
      console.error(`[S3_CLEANUP_FAILED] Ticket ID: ${id}. Cần dọn rác thủ công hoặc cron job:`, s3Error);
    }
  }

  return result;
};

export const TICKET_SERVICE = {
  createOne,
  onGetData,
  onCancel
};