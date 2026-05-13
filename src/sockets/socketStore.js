const userSocketMap = {};

// { userId: { sessionId: { socketId: socket } } }

export function addUserSocket(userId, sessionId, socket) {
  if (!userSocketMap[userId]) {
    userSocketMap[userId] = {};
  }

  if (!userSocketMap[userId][sessionId]) {
    userSocketMap[userId][sessionId] = {};
  }

  userSocketMap[userId][sessionId][socket.id] = socket;
}

export function removeUserSocket(userId, sessionId, socketId = null) {
  if (!userSocketMap[userId]) return;

  const sessionSockets = userSocketMap[userId][sessionId];
  if (!sessionSockets) return;

  if (socketId) {
    delete sessionSockets[socketId];
  } else {
    delete userSocketMap[userId][sessionId];
  }

  if (Object.keys(sessionSockets).length === 0) {
    delete userSocketMap[userId][sessionId];
  }

  if (Object.keys(userSocketMap[userId]).length === 0) {
    delete userSocketMap[userId];
  }
}

export function disconnectUserSession(userId, sessionId) {
  const userSessions = userSocketMap[userId];
  if (!userSessions) return;

  const sessionSockets = userSessions[sessionId];
  if (!sessionSockets) return;

  const sockets = Object.values(sessionSockets);
  sockets.forEach((socket) => {
    if (socket?.connected) {
      socket.disconnect(true);
    }
  });

  if (!userSocketMap[userId]) return;

  delete userSocketMap[userId][sessionId];

  if (Object.keys(userSocketMap[userId]).length === 0) {
    delete userSocketMap[userId];
  }
}

export function getOnlineUserIds() {
  return Object.keys(userSocketMap);
}

export function isUserOnline(userId) {
  if (!userSocketMap[userId]) return false;

  return Object.values(userSocketMap[userId]).some(
    (sessionSockets) => Object.keys(sessionSockets).length > 0
  );
}

export function emitToUser(userId, eventName, payload) {
  const sessions = userSocketMap[userId];
  if (!sessions) return;

  Object.values(sessions).forEach((sessionSockets) => {
    Object.values(sessionSockets).forEach((socket) => {
      if (socket?.connected) {
        socket.emit(eventName, payload);
      }
    });
  });
}
