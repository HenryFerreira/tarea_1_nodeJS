const express = require("express");
const router = express.Router();

const historial_controller = require("../controllers/historial.controller");

// Crear historial
router.post("/", historial_controller.historial_create);

// Todas los historiales
router.get("/", historial_controller.historial_list);

// Obtener historial por ID usuario
router.get("/usuario/:idUsuario", historial_controller.historial_by_usuario);

module.exports = router;
