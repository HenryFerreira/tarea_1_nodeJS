/**
 * Router de Selección / Choques
 * =============================
 * Montado en /seleccion:
 *  - POST /seleccion/verificar
 *
 * En prod:
 *  - Activá requireAuth para exigir Access Token.
 */

const router = require("express").Router();
const seleccion_controller = require("../controllers/seleccion.controller");
const { requireAuth } = require("../middlewares/auth");


// Cuando uses JWT real, protegé con requireAuth:
router.post("/verificar", requireAuth, seleccion_controller.verificar);

module.exports = router;
