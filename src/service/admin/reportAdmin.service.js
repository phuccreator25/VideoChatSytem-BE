import { ObjectId } from "mongodb"
import { TICKET_REPOSITORY } from "../../repository/ticket.repository.js"
import { reportStatuses } from "../../data/ticket.data.js"
import { client } from "../../config/database.js"
import { MESSAGE_REPOSITORY } from "../../repository/message.repository.js"
import { USER_REPOSITORY } from "../../repository/user.repository.js"
import { USER_ADMIN_SERVICE } from "./userAdmin.service.js"
import { role } from "../../data/user.data.js"

const onGetData = async (filters = {}, page, limit) => {
    try {
        const [reports, kpi] = await Promise.all([
            TICKET_REPOSITORY.findManyByAdmin({ filters, page, limit }),
            TICKET_REPOSITORY.countKPIs()
        ])

        return { reports, kpi }
    } catch (error) {
        throw error
    }
}

const onProgress = async (id, currentAdminId) => {
    try {
        if (!id) throw new Error("Ticket ID is required");
        if (!currentAdminId) throw new Error("Admin ID is required");

        const ticket = await TICKET_REPOSITORY.findOne({
            filters: { _id: new ObjectId(id) }
        });

        if (!ticket) throw new Error("Ticket not found");

        if (ticket.status !== reportStatuses.PENDING) {
            throw new Error(`Ticket cannot be progressed because it is already ${ticket.status}`);
        }

        const result = await TICKET_REPOSITORY.updateOne(
            {
                _id: new ObjectId(id),
                status: reportStatuses.PENDING
            },
            {
                $set: {
                    status: reportStatuses.IN_PROGRESS,
                    assignedTo: currentAdminId.toString(),
                    assignedAt: new Date(),
                    updatedAt: new Date()
                }
            }
        );

        if (result.matchedCount === 0 || result.modifiedCount === 0) {
            throw new Error("Ticket has already been taken by another admin");
        }

        return {
            ticketId: id,
            status: reportStatuses.IN_PROGRESS,
            assignedTo: currentAdminId,
            assignedAt: new Date()
        };
    } catch (error) {
        throw error;
    }
};

const onResolveTicket = async ({
    ticketId,
    currentAdminId,
    resolutionActions, 
    status, 
    feedbackToReporter,
    adminNotes,
    unBannedAt,
}) => {
    const session = client.startSession();
    try {
        session.startTransaction();

        if (!ticketId) throw new Error("Ticket ID is required");
        if (!currentAdminId) throw new Error("Admin ID is required");

        const ticket = await TICKET_REPOSITORY.findOne({
            filters: { _id: new ObjectId(ticketId) },
            options: { session }
        });

        if (!ticket) throw new Error('Ticket not found');

        if ([reportStatuses.RESOLVED, reportStatuses.REJECTED].includes(ticket.status)) {
            throw new Error(`Ticket has already been finalized as ${ticket.status}`);
        }

        let actions = [];
        if (status === reportStatuses.REJECTED) {
            actions = ['dismissed'];
        } else if (Array.isArray(resolutionActions) && resolutionActions.length > 0) {
            actions = [...new Set(resolutionActions)].slice(0, 3);
        } else {
            actions = ['none'];
        }

        if (status === reportStatuses.RESOLVED) {
            if (actions.includes('deleted_message') && ticket.targetType === 'message') {
                await MESSAGE_REPOSITORY.updateOne(
                    { _id: new ObjectId(ticket.messageId) },
                    {
                        $set: {
                            moderation: {
                                isModerated: true,
                                moderatedAt: new Date(),
                                reason: ticket.reason,
                                moderatedBy: currentAdminId.toString(),
                                ticketId: ticket._id.toString()
                            },
                            updatedAt: new Date(),
                        },
                    }, session 
                );
            }

            if (actions.includes('warned_user')) {
                const MAX_WARNINGS = 3;

                const warningEntry = {
                    reason: ticket.reason,
                    warningAt: new Date(),
                    warningBy: currentAdminId.toString(),
                };

                const updatedUser = await USER_REPOSITORY.updateById(
                    ticket.targetUserId,
                    {
                        $inc: { warningCount: 1 },
                        $push: { warning: warningEntry },
                        $set: { updatedAt: new Date() },
                    },
                    { session }
                );

                if (updatedUser && updatedUser.warningCount >= MAX_WARNINGS && !actions.includes('banned_user')) {
                    await USER_ADMIN_SERVICE.onBanUser({
                        _id: ticket.targetUserId,
                        payload: {
                            banReason: `Account is banned due to accumulated ${MAX_WARNINGS} warnings.`,
                        },
                        adminId: currentAdminId,
                        session
                    });
                }
            }

            if (actions.includes('banned_user')) {
                await USER_ADMIN_SERVICE.onBanUser({
                    _id: ticket.targetUserId,
                    payload: {
                        banReason: ticket.reason,
                        unBannedAt: unBannedAt || null,
                    },
                    adminId: currentAdminId,
                    session
                });
            }
        }

        const isBanned = actions.includes('banned_user');

        const updatePayload = {
            status,
            resolutionActions: actions,
            feedbackToReporter: feedbackToReporter || null,
            adminNotes: adminNotes || null,
            resolvedAt: new Date(),
            unBannedAt: isBanned && unBannedAt ? new Date(unBannedAt) : null,
            updatedAt: new Date(),
        };

        await TICKET_REPOSITORY.updateOne(
            { _id: new ObjectId(ticketId) },
            { $set: updatePayload },
            { session } 
        );

        await session.commitTransaction();

        return {
            ticketId,
            status,
            resolutionActions: actions,
            resolvedAt: updatePayload.resolvedAt,
        };
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        await session.endSession();
    }
}; 

const onReleaseTicket = async({_id, currentAdminId}) => {
    try {

        if(!_id) throw new Error('Ticket ID is required');
        if(!currentAdminId) throw new Error('Admin ID is required');

        const isAdmin = await USER_REPOSITORY.findById(currentAdminId);

        if(!isAdmin) throw new Error('Please try login again');

        const isTicket = await TICKET_REPOSITORY.findOne({filters: {_id: new ObjectId(_id)}}); 

        if(!isTicket) throw new Error('Ticket not found');

        if(isTicket.status !== reportStatuses.IN_PROGRESS) throw new Error ('Ticket not in progress');

        const isCurrentAssignee = isTicket.assignedTo?.toString() === currentAdminId.toString();
        const isSuperAdmin = isAdmin.role === role.SUPPER_ADMIN;

        if (!isCurrentAssignee && !isSuperAdmin) throw new Error('You are not authorized to release this ticket');

        await TICKET_REPOSITORY.updateOne(
            { 
                _id: new ObjectId(_id),
                status: reportStatuses.IN_PROGRESS
            }, 
            { $set: {
                status: reportStatuses.PENDING,
                assignedTo: null,
                assignedAt: null,
                updatedAt: new Date(),
            }})

        return 
    } catch (error) {
        throw(error)
    }
} 

export const REPORT_ADMIN_SERVICE = {
    onGetData,
    onProgress,
    onResolveTicket,
    onReleaseTicket
}