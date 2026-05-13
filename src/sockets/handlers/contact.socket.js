export const registerContactSocket = (io, socket) => {
  socket.on("contact:join", () => {
    socket.emit("contact:leave", { ok: true });
  });
}