/**
 * Router de Elegibilidad
 * ======================
 * En producción:
 *  - Usá requireAuth para exigir Access Token.
 */

const router = require("express").Router();
const elegibilidad_controller = require("../controllers/elegibilidad.controller");
const { requireAuth } = require("../middlewares/auth"); // activar cuando tengas login

router.get("/", requireAuth, elegibilidad_controller.getElegibilidad);

module.exports = router;
