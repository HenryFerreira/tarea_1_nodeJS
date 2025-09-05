/**
 * Router de Materias
 * ==================
 * Reglas de autorización:
 * - Crear/actualizar/eliminar/gestionar previas/horarios => ADMIN
 * - Listar y ver por id pueden ser públicos (o autenticados si preferís).
 */


const express = require("express");
const router = express.Router();
const materia_controller = require("../controllers/materia.controller");
const { requireAuth, requireRole } = require("../middlewares/auth");

// Crear materia (ADMIN)
router.post("/", requireAuth, requireRole("ADMIN"), materia_controller.materia_create);

// Listar (público o autenticado, según tu consigna)
/* requireAuth, */
router.get("/",  materia_controller.materia_list);

// Ver por ID (público o autenticado)
/* requireAuth, */
router.get("/:id",  materia_controller.materia_by_id);

// Actualizar (ADMIN)
router.put("/:id", requireAuth, requireRole("ADMIN"), materia_controller.materia_update);

// Eliminar (ADMIN)
router.delete("/:id", requireAuth, requireRole("ADMIN"), materia_controller.materia_delete);

// Previas (ADMIN)
router.post("/:id/previas", requireAuth, requireRole("ADMIN"), materia_controller.materia_add_previa);
router.delete("/:id/previas", requireAuth, requireRole("ADMIN"), materia_controller.materia_remove_previa);

// Horarios (ADMIN)
router.post("/:id/horarios", requireAuth, requireRole("ADMIN"), materia_controller.materia_add_horario);
router.delete("/:id/horarios", requireAuth, requireRole("ADMIN"), materia_controller.materia_remove_horario);

module.exports = router;
