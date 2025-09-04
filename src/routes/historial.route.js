const express = require("express");
const router = express.Router();

const historial_controller = require("../controllers/historial.controller");

// Crear compra
router.post("/", historial_controller.historial_create);

// Todas las compras
router.get("/", historial_controller.historial_list);

// Compras por usuario
router.get("/usuario/:idUsuario", historial_controller.historial_by_usuario);

module.exports = router;
