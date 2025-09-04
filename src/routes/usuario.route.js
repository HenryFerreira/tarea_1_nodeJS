const express = require("express");
const router = express.Router();

const usuario_controller = require("../controllers/usuario.controller");

// Crear usuario
router.post("/", usuario_controller.usuario_create);

// Todas los usuarios
router.get("/", usuario_controller.usuario_list);

// Obtener usuario por ID
router.get("/usuario/:idUsuario", usuario_controller.usuario_by_id);

// Eliminar usuario por ID
router.delete("/usuario/:idUsuario", usuario_controller.usuario_delete);

// Actualizar usuario por ID
router.put("/usuario/:idUsuario", usuario_controller.usuario_update);

module.exports = router;
