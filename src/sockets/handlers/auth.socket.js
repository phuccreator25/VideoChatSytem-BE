import { MESSAGE_DELIVERY_SERVICE } from "../../service/client/messageDelivery.service.js";
import { USER_SERVICE } from "../../service/client/user.service.js";

export const registerAuthSocket = async (io, socket) => {
  const userId = socket.userId;
  const sessionId = socket.sessionId;

  if (!userId || !sessionId) return;

  await USER_SERVICE.onHandleUserConnected({userId, sessionId, socket})

  await MESSAGE_DELIVERY_SERVICE.onUpdateStatusMessage(userId)

  socket.on("disconnect", async () => {
    await USER_SERVICE.onHandleUserDisconnected({userId, sessionId, socket})
  });
};
