import { CONVERSATION_SERVICE } from "../service/conversation.service.js";

const onGetOrCreateConversation = async (req, res, next) => {
    try {
        const { userId } = req.body;
        const currentUserId = req.user.id;

        const conversation = await CONVERSATION_SERVICE.onGetOrCreateConversation({ currentUserId, userId });
        res.status(200).json({
            data: conversation,
        });
    } catch (error) {
        next(error);
    }
}

const onGetConversationById = async (req, res, next) => {
    try {
        const conversationId = req.params.conversationId;
        const currentUserId = req.user.id;

        const conversation = await CONVERSATION_SERVICE.onGetConversationById({ conversationId, currentUserId });

        return res.status(200).json({
            data: conversation,
        });
    } catch (error) {
        next(error);
    }
}

export const CONVERSATION_CONTROLLER = {
    onGetOrCreateConversation,
    onGetConversationById,
}