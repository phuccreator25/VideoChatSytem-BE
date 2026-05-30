import { MESSAGE_DELIVERY_REPOSITORY } from "../repository/messageDeliveries.repository.js";
import { emitReceivedMessages } from "../sockets/emitters/messages.emitter.js";
import { isUserOnline } from "../sockets/socketStore.js";

const onUpdateStatusMessage = async (userId) => {
  const senderIds = new Set();
  const receivedMessage =
    await MESSAGE_DELIVERY_REPOSITORY.findAndUpdateMany(userId);

  if (receivedMessage.length > 0) {
    receivedMessage.forEach((msg) => {
      if (!msg.senderId) return;
      if (!isUserOnline(msg.senderId)) return;

      if (!senderIds.has(msg.senderId)) {
        senderIds.add(msg.senderId);

        emitReceivedMessages(msg.senderId, {
          conversationId: msg.conversationId,
          deliveredAt: msg.deliveredAt,
        });
      }
    });
  }
};

export const MESSAGE_DELIVERY_SERVICE = {
  onUpdateStatusMessage,
};
