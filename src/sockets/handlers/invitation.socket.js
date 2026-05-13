export const registerInvitationSocket = (io, socket) => {
  socket.on("invitation:join", () => {
    socket.emit("invitation:leave", { ok: true });
  });
};