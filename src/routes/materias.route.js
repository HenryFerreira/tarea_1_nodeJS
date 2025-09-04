const express = require("express");
const router = express.Router();

const materia_controller = require("../controllers/materia.controller");

// Crear materia
router.post("/", materia_controller.materia_create);

// Listar todas las materias (con filtros opcionales ?q=&semestre=&limit=&page=)
router.get("/", materia_controller.materia_list);

// Obtener materia por ID
router.get("/:id", materia_controller.materia_by_id);

// Actualizar materia por ID
router.put("/:id", materia_controller.materia_update);

// Eliminar materia por ID
router.delete("/:id", materia_controller.materia_delete);

// Agregar una previa a la materia (:id)
router.post("/:id/previas", materia_controller.materia_add_previa);

// Eliminar una previa de la materia (:id) - body: { tipo, materiaPreviaId }
router.delete("/:id/previas", materia_controller.materia_remove_previa);

// Agregar un horario a la materia (:id)
router.post("/:id/horarios", materia_controller.materia_add_horario);

// Eliminar un horario de la materia (:id) - body: { dia, inicio, fin }
router.delete("/:id/horarios", materia_controller.materia_remove_horario);

module.exports = router;
