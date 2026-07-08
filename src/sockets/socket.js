import { Server } from "socket.io";
import http from "http";
import express from "express";
import env from "../config/env.js";
import { socketMiddleware } from "../middleware/socketMiddleware.js";
import { registerAuthSocket } from "./handlers/auth.socket.js";
import { registerMessageSocket, registerTypingMessageSocket } from "./handlers/messages.socket.js";
import { registerCallSocket } from "./handlers/call.socket.js";

const app = express();
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:30080',
      'http://127.0.0.1:30080',
      'https://videochatsystem-fe.vercel.app'
    ],
    credentials: true,
  },
  transports: ["websocket"],
});

io.use(socketMiddleware);

io.on("connection", async (socket) => {
  console.log(
    `User connected: ${socket.user?.fullname} (session: ${socket.sessionId})`
  );

  await registerAuthSocket(io, socket);
  registerMessageSocket(io, socket);
  registerTypingMessageSocket(io, socket);
  registerCallSocket(io, socket);
});

export { io, app, server };