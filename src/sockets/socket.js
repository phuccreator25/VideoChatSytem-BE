import { Server } from "socket.io";
import http from "http";
import express from "express";
import env from "../config/env.js";
import { socketMiddleware } from "../middleware/socketMiddleware.js";
import { registerAuthSocket } from "./handlers/auth.socket.js";
import { registerInvitationSocket } from "./handlers/invitation.socket.js";
import { registerContactSocket } from "./handlers/contact.socket.js";

const app = express();
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: env.HOST_NAME || "http://localhost:5173",
    credentials: true,
  },
});

io.use(socketMiddleware);

io.on("connection", async (socket) => {
  console.log(
    `User connected: ${socket.user?.fullname} (session: ${socket.sessionId})`
  );

  await registerAuthSocket(io, socket);
  registerInvitationSocket(io, socket);
  registerContactSocket(io, socket);
});

export { io, app, server };