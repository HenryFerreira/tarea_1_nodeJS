/**
 * Controlador de Usuarios
 * - CRUD básico con buenas prácticas:
 *   * Hash de password al crear/actualizar
 *   * No exponer passwordHash en respuestas
 *   * Manejo de E11000 (email duplicado)
 *   * Logs (winston) con reqId para correlación
 *   * Eventos de dominio (bus.emit)
 */
const { Types } = require("mongoose");
const Usuario = require("../models/usuario.model");
const { logger } = require("../logger/logger");
const bus = require("../events/bus");

// Helper: serializa un usuario sin campos sensibles
function toPublicUser(u) {
  return {
    _id: u._id,
    email: u.email,
    nombre: u.nombre,
    rol: u.rol,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}

/**
 * POST /api/usuarios
 * Crea un usuario nuevo.
 * body: { email, password, nombre?, rol? }
 */
exports.usuario_create = async (req, res, next) => {
  try {
    const { email, password, nombre, rol } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "email y password son requeridos", reqId: req.id });
    }

    const passwordHash = await Usuario.hashPassword(password);
    const user = await Usuario.create({ email, passwordHash, nombre, rol });

    // Evento + log
    bus.emit("usuario:creado", { 
        reqId: req.id, 
        userId: user._id.toString(), 
        email: user.email 
    });
    logger.info("Usuario creado", { 
        reqId: req.id, 
        userId: user._id.toString(), 
        email: user.email 
    });

    res.status(201).json(toPublicUser(user));
  } catch (err) {
    // Email duplicado (índice unique)
    if (err?.code === 11000) {
      logger.warn("Intento de crear usuario con email duplicado", { 
        reqId: req.id, 
        email: req.body?.email 
    });
      return res.status(409).json({ error: "El email ya está registrado", reqId: req.id });
    }
    next(err);
  }
};

/**
 * GET /api/usuarios
 * Lista usuarios (opcional: filtrar por rol).
 * query: ?rol=ADMIN|ESTUDIANTE
 */
exports.usuario_list = async (req, res, next) => {
  try {
    const { rol } = req.query;
    const q = {};
    if (rol) q.rol = rol;

    const usuarios = await Usuario.find(q).lean();
    const data = usuarios.map(toPublicUser);

    logger.info("Listado de usuarios", { 
        reqId: req.id, 
        count: data.length, 
        rol: rol || "ALL" 
    });
    res.json(data);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/usuarios/:id
 * Obtiene un usuario por ID.
 */
exports.usuario_by_id = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "ID inválido", reqId: req.id });
    }

    const user = await Usuario.findById(id);
    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado", reqId: req.id });
    }

    logger.info("Usuario consultado", { 
        reqId: req.id, 
        userId: id 
    });
    res.json(toPublicUser(user));
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/usuarios/:id
 * Actualiza campos (nombre, rol y/o password).
 * body: { nombre?, rol?, password? }
 */
exports.usuario_update = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "ID inválido", reqId: req.id });
    }

    const user = await Usuario.findById(id);
    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado", reqId: req.id });
    }

    const { nombre, rol, password } = req.body;
    if (typeof nombre === "string") user.nombre = nombre.trim();
    if (rol) user.rol = rol; // valida en el enum del schema
    if (password) user.passwordHash = await Usuario.hashPassword(password);

    await user.save();

    bus.emit("usuario:actualizado", { 
        reqId: req.id, 
        userId: user._id.toString(), 
        cambios: Object.keys(req.body) 
    });
    logger.info("Usuario actualizado", { 
        reqId: req.id, 
        userId: user._id.toString(), 
        cambios: Object.keys(req.body) 
    });

    res.json(toPublicUser(user));
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/usuarios/:id
 * Elimina físicamente el usuario.
 * (Si más adelante querés "soft delete", cambia a bandera isActive=false)
 */
exports.usuario_delete = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "ID inválido", reqId: req.id });
    }

    const user = await Usuario.findByIdAndDelete(id);
    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado", reqId: req.id });
    }

    bus.emit("usuario:eliminado", { 
        reqId: req.id, 
        userId: user._id.toString(), 
        email: user.email 
    });
    logger.info("Usuario eliminado", { 
        reqId: req.id, 
        userId: user._id.toString(), 
        email: user.email 
    });

    res.json({ ok: true, eliminado: toPublicUser(user) });
  } catch (err) {
    next(err);
  }
};
