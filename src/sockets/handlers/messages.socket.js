import { CHAT_SERVICE } from "../../service/chat.service.js";
import { emitToUser } from "../socketStore.js";

export const registerMessageSocket = (io, socket) => {
  socket.on("messages:read", async ({ conversationId }) => {
    try {
      const currentUserId = socket.userId;

      if (!conversationId || !currentUserId) {
        socket.emit("messages:read:error", {
          message: "Missing conversationId or userId",
        });
        return;
      }

      const result = await CHAT_SERVICE.markConversationAsRead({
        conversationId,
        currentUserId,
      });

      emitToUser(result?.senderId, "messages:read:success", {
        conversationId,
        ...result,
      });

      emitToUser(result?.readerUserId, "messages:read:success", {
        conversationId,
        ...result,
      });
      
    } catch (error) {
      console.error("messages:read error:", error);

      socket.emit("messages:read:error", {
        message: error.message || "Mark conversation as read failed",
      });
    }
  });
};