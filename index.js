const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const path = require("path");

// 1) Cargar variables de entorno temprano
require("dotenv").config({ path: path.resolve(process.cwd(), ".env") });

const app = express();

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

// Vistas
app.set('view engine', 'ejs');

//const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor arriba en http://localhost:${PORT}`));
