const express = require("express");
const router = express.Router();

const auth_controller = require("../controllers/auth.controller");

// Registro y login
router.post("/register", auth_controller.auth_register);
router.post("/login", auth_controller.auth_login);

// Ciclo de tokens
router.post("/refresh", auth_controller.auth_refresh);
router.post("/logout", auth_controller.auth_logout);

module.exports = router;
