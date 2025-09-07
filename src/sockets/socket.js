/**
 * Socket.IO + Bus Bridge
 * ======================
 * - Auth con JWT (Access) en el handshake
 * - Room por usuario: "user:<id>"
 * - Puentea bus -> WS:
 *    * materia:creada/actualizada/eliminada -> io.emit(...)
 *    * historial:actualizado -> io.to("user:<usuarioId>").emit(...)
 */
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const bus = require("../events/bus");
const { logger } = require("../logger/logger");

let ioRef = null;

function getTokenFromHandshake(socket) {
  // 1) Authorization: Bearer <token>
  const h = socket.handshake.headers.authorization || socket.handshake.headers.Authorization;
  if (h && String(h).startsWith("Bearer ")) return String(h).slice(7);
  // 2) auth.token (cliente web: io(URL, { auth:{ token } }))
  if (socket.handshake.auth && socket.handshake.auth.token) return socket.handshake.auth.token;
  // 3) query.token (alternativa)
  if (socket.handshake.query && socket.handshake.query.token) return socket.handshake.query.token;
  return null;
}

function initSocket(httpServer) {
  const origins = (process.env.SOCKET_CORS_ORIGIN || "*")
    .split(",").map(s => s.trim()).filter(Boolean);

  const io = new Server(httpServer, {
    cors: {
      origin: origins,           // ej: ['http://localhost:5173','http://localhost:3000']
      credentials: true,
      methods: ["GET","POST"]
    }
  });
  ioRef = io;

  // Auth de cada conexión
  io.use((socket, next) => {
    try {
      const token = getTokenFromHandshake(socket);
      if (!token) return next(new Error("missing_token"));
      const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      socket.user = { _id: payload.sub, email: payload.email, rol: payload.rol };
      next();
    } catch (err) {
      next(new Error("invalid_token"));
    }
  });

  // Conexión
  io.on("connection", (socket) => {
    const userId = socket.user?._id;
    if (userId) socket.join(`user:${userId}`);

    logger.info("WS conectado", { sid: socket.id, userId, origins });

    // pequeño ping/pong de prueba
    socket.on("ping", (msg) => socket.emit("pong", { now: Date.now(), youSent: msg }));

    socket.on("disconnect", (reason) => {
      logger.info("WS desconectado", { sid: socket.id, userId, reason });
    });
  });

  // ---- Puente bus -> WS ----
  // Materias (broadcast)
  bus.on("materia:creada",      (payload) => io.emit("materia:creada", payload));
  bus.on("materia:actualizada", (payload) => io.emit("materia:actualizada", payload));
  bus.on("materia:eliminada",   (payload) => io.emit("materia:eliminada", payload));

  // Historial (dirigido)
  bus.on("historial:actualizado", (payload) => {
    if (payload?.usuarioId) io.to(`user:${payload.usuarioId}`).emit("historial:actualizado", payload);
  });

  // (Opcional) otros eventos útiles
  bus.on("elegibilidad:consultada", (payload) => {
    if (payload?.userId) io.to(`user:${payload.userId}`).emit("elegibilidad:consultada", payload);
  });

  return io;
}

function getIO() { return ioRef; }

module.exports = { initSocket, getIO };
