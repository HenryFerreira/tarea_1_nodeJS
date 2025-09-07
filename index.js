const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const morgan = require("morgan");
const path = require("path");

// 1) Cargar variables de entorno temprano
require("dotenv").config({ path: path.resolve(process.cwd(), ".env") });

const { logger } = require("./src/logger/logger");
const requestId = require("./src/middlewares/requestId");
const bus = require("./src/events/bus");


const historial = require("./src/routes/historial.route");
const usuario = require("./src/routes/usuario.route");
const materia = require("./src/routes/materias.route");
const auth = require("./src/routes/auth.routes");
const devFakeAuth = require("./src/middlewares/devFakeAuth");
const elegibilidad = require("./src/routes/elegibilidad.routes");
const seleccion = require("./src/routes/seleccion.routes");

const app = express();

// ---- middleware base ----
app.use(requestId); // req.id para correlacionar logs
app.use((req, res, next) => { res.locals.reqId = req.id; next(); });
// Activa auth falsa SOLO si DEV_FAKE_AUTH=1 y NO estás en producción
app.use(devFakeAuth());

// Logs HTTP (morgan) → winston
morgan.token("id", (req) => req.id);
const httpFormat = ':id :method :url :status :res[content-length] - :response-time ms';
app.use(morgan(httpFormat, { stream: logger.stream }));

// CONEXIÓN A MONGO
// 2) Tomar valores desde process.env (con defaults si querés)
const MONGO_URI = process.env.MONGO_URI;
const PORT = process.env.PORT || 3000;

// 3) Validar que exista la URI
if (!MONGO_URI) {
  console.error("❌ Falta MONGO_URI en .env");
  process.exit(1);
}

// 4) Conexión a Mongo (podés pasar dbName si tu URI no lo trae)
mongoose
  .connect(MONGO_URI, {
    // dbName: process.env.MONGO_DB_NAME, // opcional si no está en la URI
    serverSelectionTimeoutMS: 8000,
  })
  .then(() => console.log("✅ Conectado a MongoDB Atlas"))
  .catch((err) => {
    console.error("❌ Error de conexión:", err);
    process.exit(1);
  });


mongoose.Promise = global.Promise;
const db = mongoose.connection;
db.on("error", console.error.bind(console, "MongoDB connection error:"));
db.once("open", () => console.log("MongoDB conectado"));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// RUTAS
//app.use("/products", product);
app.use("/historial", historial);
app.use("/usuario", usuario);
app.use("/materia", materia);
app.use("/auth", auth);
app.use("/elegibilidad", elegibilidad);
app.use("/seleccion", seleccion);



// ---- listeners de eventos de dominio ----
bus.on("materia:creada", (payload) => {
  logger.info("materia:creada", { reqId: payload.reqId, materiaId: payload.materiaId, userId: payload.userId });
});

bus.on("historial:actualizado", (payload) => {
  logger.info("historial:actualizado", { 
    reqId: payload.reqId, 
    usuario: payload.usuarioId,
    materia: payload.materiaId, 
    estado: payload.estado 
  });
});

bus.on("auth:login", (payload) => {
  logger.info("auth:login", { reqId: payload.reqId, userId: payload.userId });
});

// ---- manejador de errores central ----
app.use((err, req, res, next) => {
  logger.error("Unhandled error", { reqId: req.id, err });
  res.status(err.status || 500).json({ error: "Internal Server Error", reqId: req.id });
});


// ---- errores no atrapados a nivel proceso ----
process.on("unhandledRejection", (reason) => logger.error("unhandledRejection", { err: reason }));
process.on("uncaughtException", (err) => {
  logger.error("uncaughtException", { err });
  process.exit(1);
});


// Vistas
app.set('view engine', 'ejs');

// ---- server ----
//const PORT = process.env.PORT || 3000;
app.listen(PORT, () => logger.info(`Servidor arriba en http://localhost:${PORT}`));