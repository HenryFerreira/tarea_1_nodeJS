/**
 * Cliente de prueba (Node)
 * ------------------------
 * Ejecutá con:
 *  ACCESS=eyJ...  node scripts/ws-test.js
 */

const { io } = require("socket.io-client");

const BASE = process.env.BASE || "http://localhost:3000";
const ACCESS = process.env.ACCESS; // poné tu accessToken aquí
if (!ACCESS) {
  console.error("Falta env ACCESS con un accessToken válido");
  process.exit(1);
}

const socket = io(BASE, {
  transports: ["websocket"],
  auth: { token: ACCESS }, // el server lo lee en handshake.auth.token
});

// Eventos comunes
socket.on("connect", () => {
  console.log("[socket] conectado", socket.id);
  socket.emit("ping", "hola");
});

socket.on("pong", (msg) => {
  console.log("[socket] pong:", msg);
});

socket.on("materia:creada", (e) => console.log("[materia:creada]", e));
socket.on("materia:actualizada", (e) => console.log("[materia:actualizada]", e));
socket.on("materia:eliminada", (e) => console.log("[materia:eliminada]", e));

socket.on("historial:actualizado", (e) => console.log("[historial:actualizado]", e));

socket.on("disconnect", (reason) => console.log("[socket] disconnect:", reason));
socket.on("connect_error", (err) => console.log("[socket] error:", err.message));
