// ------------------------------
//  Core & setup
// ------------------------------
const express   = require("express");
const bodyParser= require("body-parser");
const mongoose  = require("mongoose");
const morgan    = require("morgan");
const path      = require("path");
const cors      = require("cors");

// Cargar .env lo más temprano posible
require("dotenv").config({ path: path.resolve(process.cwd(), ".env") });

const { logger }   = require("./src/logger/logger");
const requestId    = require("./src/middlewares/requestId");
const bus          = require("./src/events/bus");
const { initSocket } = require("./src/sockets/socket");

// Routers (API)
const auth         = require("./src/routes/auth.routes");
const elegibilidad = require("./src/routes/elegibilidad.routes");
const seleccion    = require("./src/routes/seleccion.routes");
const usuario      = require("./src/routes/usuario.route");
const materia      = require("./src/routes/materias.route");
const historial    = require("./src/routes/historial.route");

// Routers (UI - EJS)
const uiRoutes     = require("./src/routes/ui.routes");

// App
const app  = express();
const PORT = process.env.PORT || 3000;

// ------------------------------
//  Middlewares globales
// ------------------------------
app.use(requestId);                                // ID por request para trazabilidad
app.use((req, res, next) => { res.locals.reqId = req.id; next(); });

morgan.token("id", (req) => req.id);
const httpFormat = ':id :method :url :status :res[content-length] - :response-time ms';
app.use(morgan(httpFormat, { stream: logger.stream }));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

const origins = (process.env.CORS_ORIGIN || "*")
  .split(",").map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: origins,
  credentials: true,
  methods: ["GET","POST","PUT","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"]
}));

// ------------------------------
//  Vistas (EJS) + estáticos
// ------------------------------
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "src", "views"));
app.use(express.static(path.join(__dirname, "src", "public"))); // (sirve /ws-test.html, css, js, etc.)

// ------------------------------
//  Rutas UI (montar primero)
// ------------------------------
app.use("/", uiRoutes);   // "/", "/login", "/register", "/logout", "/admin", ...

// ------------------------------
//  Rutas API (con prefijos estables)
//   - Estos prefijos evitan choques con la UI y son los que usa el front:
//     /auth/*, /elegibilidad, /seleccion, /api/usuarios, /api/materias, /api/historial
// ------------------------------
app.use("/auth",          auth);
app.use("/elegibilidad",  elegibilidad);
app.use("/seleccion",     seleccion);
app.use("/api/usuarios",  usuario);
app.use("/api/materias",  materia);
app.use("/api/historial", historial);

// ------------------------------
//  Eventos de dominio (logs)
// ------------------------------
bus.on("materia:creada", (payload) => {
  logger.info("materia:creada", { reqId: payload.reqId, materiaId: payload.materiaId, userId: payload.userId });
});
bus.on("historial:actualizado", (payload) => {
  logger.info("historial:actualizado", {
    reqId: payload.reqId, usuario: payload.usuarioId, materia: payload.materiaId, estado: payload.estado
  });
});
bus.on("auth:login", (payload) => {
  logger.info("auth:login", { reqId: payload.reqId, userId: payload.userId });
});

// ------------------------------
//  Manejo de errores central
// ------------------------------
app.use((err, req, res, next) => {
  logger.error("Unhandled error", { reqId: req.id, err });
  res.status(err.status || 500).json({ error: "Internal Server Error", reqId: req.id });
});

// ------------------------------
//  Conexión a MongoDB
// ------------------------------
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error("❌ Falta MONGO_URI en .env");
  process.exit(1);
}

mongoose
  .connect(MONGO_URI, { serverSelectionTimeoutMS: 8000 /*, dbName: process.env.MONGO_DB_NAME*/ })
  .then(() => console.log("✅ Conectado a MongoDB Atlas"))
  .catch((err) => {
    console.error("❌ Error de conexión:", err);
    process.exit(1);
  });

mongoose.Promise = global.Promise;
const db = mongoose.connection;
db.on("error", console.error.bind(console, "MongoDB connection error:"));
db.once("open", () => console.log("MongoDB conectado"));

// ------------------------------
//  HTTP + Socket.IO
// ------------------------------
const http = require("http");
const httpServer = http.createServer(app);
const io = initSocket(httpServer); // (se exporta si querés usar luego)

// ------------------------------
//  Start
// ------------------------------
httpServer.listen(PORT, () => {
  console.log(`Servidor arriba en http://localhost:${PORT}`);
});
