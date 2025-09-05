/**
 * Router de Elegibilidad
 * ======================
 * En desarrollo:
 *  - Usar devFakeAuth (req.user) para probar sin login.
 * En producción:
 *  - Usá requireAuth para exigir Access Token.
 */

const router = require("express").Router();
const elegibilidad_controller = require("../controllers/elegibilidad.controller");
//const { requireAuth } = require("../middlewares/auth"); // activar cuando tengas login

// En dev (con devFakeAuth activo) no exigimos token.
// Luego cambiar a: r.get("/", requireAuth, c.getElegibilidad);
//router.get("/", requireAuth, elegibilidad_controller.getElegibilidad);
router.get("/", elegibilidad_controller.getElegibilidad);

module.exports = router;
