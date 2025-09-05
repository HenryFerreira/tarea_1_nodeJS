const express = require("express");
const router = express.Router();

const historial_controller = require("../controllers/historial.controller");

// Crear historial
router.post("/", historial_controller.historial_create);

// Todas los historiales
router.get("/", historial_controller.historial_list);

// Obtener historial por ID usuario
router.get("/usuario/:idUsuario", historial_controller.historial_by_usuario);

// Upsert (usa req.user._id; por ahora rely en devFakeAuth)
/* requireAuth, */
router.post("/upsert", historial_controller.historial_upsert);

module.exports = router;
