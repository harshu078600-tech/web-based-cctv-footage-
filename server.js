const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, "public")));

const rooms = {};

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  socket.on("join-room", (roomId, role) => {
    socket.join(roomId);
    socket.roomId = roomId;
    socket.role = role;

    if (!rooms[roomId]) rooms[roomId] = { sender: null, receivers: [] };

    if (role === "sender") {
      rooms[roomId].sender = socket.id;
    } else {
      rooms[roomId].receivers.push(socket.id);
    }

    if (role === "receiver" && rooms[roomId].sender) {
      io.to(rooms[roomId].sender).emit("viewer-joined", socket.id);
    }

    io.to(roomId).emit("room-info", {
      room: roomId,
      viewers: rooms[roomId].receivers.length
    });

    console.log(`Room ${roomId} - ${role}: ${socket.id}`);
  });

  socket.on("offer", (data) => {
    socket.to(data.to || socket.roomId).emit("offer", { offer: data.offer, from: socket.id });
  });

  socket.on("answer", (data) => {
    socket.to(data.to).emit("answer", { answer: data.answer, from: socket.id });
  });

  socket.on("candidate", (data) => {
    socket.to(data.to || socket.roomId).emit("candidate", { candidate: data.candidate, from: socket.id });
  });

  socket.on("disconnect", () => {
    const roomId = socket.roomId;
    if (!roomId || !rooms[roomId]) return;
    if (socket.role === "sender") {
      rooms[roomId].sender = null;
      io.to(roomId).emit("sender-disconnected");
    } else {
      rooms[roomId].receivers = rooms[roomId].receivers.filter(id => id !== socket.id);
    }
    io.to(roomId).emit("room-info", {
      room: roomId,
      viewers: rooms[roomId]?.receivers?.length || 0
    });
    console.log("Disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
