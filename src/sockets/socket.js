import { Server } from 'socket.io';
import http from 'http';
import env from '../config/env.js';
import express from 'express';
import { socketMiddleware } from '../middleware/socketMiddleware.js';
import { USER_REPOSITORY } from '../repository/user.repository.js';

const app = express();
app.use(express.json());
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: env.HOST_NAME || 'http://localhost:5173',
    credentials: true,
  }
});

io.use(socketMiddleware);

// { userId: { sessionId: socket } }
const userSocketMap = {};

function addUserSocket(userId, sessionId, socket) {
  if (!userSocketMap[userId]) {
    userSocketMap[userId] = {};
  }

  userSocketMap[userId][sessionId] = socket;
}

function removeUserSocket(userId, sessionId) {
  if (!userSocketMap[userId]) return;

  delete userSocketMap[userId][sessionId];

  if (Object.keys(userSocketMap[userId]).length === 0) {
    delete userSocketMap[userId];
  }
}

function getOnlineUserIds() {
  return Object.keys(userSocketMap);
}

function isUserOnline(userId) {
  return !!userSocketMap[userId] && Object.keys(userSocketMap[userId]).length > 0;
}

function emitToUser(userId, eventName, payload) {
  const sessions = userSocketMap[userId];
  if (!sessions) return;

  Object.values(sessions).forEach((socket) => {
    if (socket?.connected) {
      socket.emit(eventName, payload);
    }
  });
}

io.on('connection', async (socket) => {
  console.log(`User connected: ${socket.user.fullname} (ID: ${socket.sessionId})`);

  const userId = socket.userId;
  const sessionId = socket.sessionId;

  if (userId && sessionId) {
    addUserSocket(userId, sessionId, socket);

    await USER_REPOSITORY.updateById({
      _id: userId,
      data: {
        status: 'online',
      },
    });
  }

  io.emit('getOnlineUsers', getOnlineUserIds());

  socket.on('disconnect', async () => {
    console.log(`A user disconnected ${socket.user.fullname} (ID: ${socket.userId})`);

    if (userId && sessionId) {
      removeUserSocket(userId, sessionId);

      if (!isUserOnline(userId)) {
        await USER_REPOSITORY.updateById({
          _id: userId,
          data: {
            status: 'offline',
            lastSeenAt: new Date(),
          },
        });
      }

      io.emit('getOnlineUsers', getOnlineUserIds());
    }
  });
});

export { io, app, server, emitToUser, isUserOnline };