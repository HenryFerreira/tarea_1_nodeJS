/**
 * Router de Selección / Choques
 * =============================
 * Montado en /seleccion:
 *  - POST /seleccion/verificar
 *
 * En dev:
 *  - Podés usar devFakeAuth para setear req.user sin login.
 * En prod:
 *  - Activá requireAuth para exigir Access Token.
 */

const router = require("express").Router();
const seleccion_controller = require("../controllers/seleccion.controller");
const { requireAuth } = require("../middlewares/auth");

// En dev (si usás devFakeAuth), podrías descomentar la línea siguiente en el futuro.
// r.post("/verificar", c.verificar);

// Cuando uses JWT real, protegé con requireAuth:
router.post("/verificar", requireAuth, seleccion_controller.verificar);

module.exports = router;
