const express = require("express");
const router = express.Router();

const historial_controller = require("../controllers/historial.controller");
const { requireAuth } = require("../middlewares/auth"); // activar cuando tengas login

// Crear historial
router.post("/", requireAuth, historial_controller.historial_create);

// Todas los historiales
router.get("/", requireAuth, historial_controller.historial_list);

// Obtener historial por ID usuario
router.get("/usuario/:idUsuario", requireAuth, historial_controller.historial_by_usuario);

//Upsert requiere usuario autenticado (usa req.user._id)
router.post("/upsert", requireAuth, historial_controller.historial_upsert);

//Créditos del usuario autenticado
router.get("/creditos", requireAuth, historial_controller.historial_creditos);

module.exports = router;
