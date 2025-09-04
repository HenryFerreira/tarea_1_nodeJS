/**
 * Controlador de Historial Académico
 * - CRUD básico y upsert con buenas prácticas:
 *   * Validación de ObjectId (usuario/materia) y campos requeridos
 *   * Manejo de E11000 (duplicado por índice único {usuario,materia})
 *   * Logs (winston) con reqId para correlación
 *   * Eventos de dominio (bus.emit) para auditoría/tiempo real
 *   * No expone datos sensibles (modelo no contiene secretos)
 */
const { Types } = require("mongoose");
const Historial = require("../models/historial.model");
const { logger } = require("../logger/logger");
const bus = require("../events/bus");

// Helper: serializa un historial con campos públicos (y respeta populate si existe)
function toPublicHistorial(h) {
  const usuario = h.usuario && typeof h.usuario === "object"
    ? { _id: h.usuario._id, email: h.usuario.email, nombre: h.usuario.nombre, rol: h.usuario.rol }
    : h.usuario; // ObjectId si no hay populate

  const materia = h.materia && typeof h.materia === "object"
    ? { _id: h.materia._id, codigo: h.materia.codigo, nombre: h.materia.nombre, semestre: h.materia.semestre, creditos: h.materia.creditos }
    : h.materia;

  return {
    _id: h._id,
    usuario,
    materia,
    estado: h.estado,
    notaExamen: h.notaExamen ?? null,
    fecha: h.fecha ?? null,
    createdAt: h.createdAt,
    updatedAt: h.updatedAt,
  };
}

/**
 * POST /api/historial
 * Crea un registro de historial para un (usuario, materia).
 * body: { usuario:ObjectId, materia:ObjectId, estado:'PENDIENTE|EN_CURSO|CURSADO|APROBADO', notaExamen?, fecha? }
 */
exports.historial_create = async (req, res, next) => {
  try {
    const { usuario, materia, estado, notaExamen, fecha } = req.body;

    // Validaciones mínimas
    if (!usuario || !materia || !estado) {
      return res.status(400).json({ error: "usuario, materia y estado son requeridos", reqId: req.id });
    }
    if (!Types.ObjectId.isValid(usuario) || !Types.ObjectId.isValid(materia)) {
      return res.status(400).json({ error: "usuario o materia no es un ObjectId válido", reqId: req.id });
    }

    const historial = await Historial.create({ usuario, materia, estado, notaExamen, fecha });

    // Evento + log
    bus.emit("historial:actualizado", {
      reqId: req.id,
      usuarioId: historial.usuario.toString(),
      materiaId: historial.materia.toString(),
      estado: historial.estado,
    });
    logger.info("Historial creado", { 
      reqId: req.id, 
      historialId: historial._id.toString() 
    });

    res.status(201).json({ mensaje: "Historial creado", historial: toPublicHistorial(historial) });
  } catch (err) {
    // Índice único ({usuario, materia}) roto => duplicado
    if (err?.code === 11000) {
      logger.warn("Intento de crear historial duplicado (usuario+materia)", { 
        reqId: req.id, 
        body: req.body 
      });
      return res.status(409).json({ error: "Ya existe historial para ese usuario y materia", reqId: req.id });
    }
    next(err);
  }
};

/**
 * GET /api/historial
 * Lista todos los historiales (con populate básico).
 * Nota: para datasets grandes, conviene paginar y/o seleccionar campos.
 */
exports.historial_list = async (req, res, next) => {
  try {
    const historiales = await Historial.find()
      .populate("usuario", "email nombre rol")
      .populate("materia", "codigo nombre semestre creditos")
      .lean();

    const data = historiales.map(toPublicHistorial);
    logger.info("Historial listado", { 
      reqId: req.id, 
      count: data.length 
    });
    res.json(data);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/historial/usuario/:id
 * Lista el historial de un usuario específico.
 */
exports.historial_by_usuario = async (req, res, next) => {
  try {
    const { id } = req.params; // también aceptamos :id por consistencia con usuarios
    const { idUsuario } = req.params; // o :idUsuario si montaste así la ruta

    const userId = idUsuario || id;
    if (!Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "idUsuario inválido", reqId: req.id });
    }

    const historiales = await Historial.find({ usuario: userId })
      .populate("materia", "codigo nombre semestre creditos")
      .lean();

    const data = historiales.map(toPublicHistorial);
    logger.info("Historial por usuario", { 
      reqId: req.id, 
      idUsuario: userId, 
      count: data.length 
    });
    res.json(data);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/historial/upsert
 * Crea o actualiza (upsert) el historial del usuario autenticado para una materia.
 * Requiere req.user._id (middleware de auth).
 * body: { materia:ObjectId, estado:'PENDIENTE|EN_CURSO|CURSADO|APROBADO', notaExamen?, fecha? }
 */
exports.historial_upsert = async (req, res, next) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ error: "No autenticado", reqId: req.id });
    }

    const { materia, estado, notaExamen, fecha } = req.body;
    if (!materia || !estado) {
      return res.status(400).json({ error: "materia y estado son requeridos", reqId: req.id });
    }
    if (!Types.ObjectId.isValid(materia)) {
      return res.status(400).json({ error: "materia no es un ObjectId válido", reqId: req.id });
    }

    const doc = await Historial.findOneAndUpdate(
      { usuario: req.user._id, materia },
      { estado, notaExamen, fecha },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    bus.emit("historial:actualizado", {
      reqId: req.id,
      usuarioId: req.user._id.toString(),
      materiaId: materia,
      estado,
    });
    logger.info("Historial upsert", {
      reqId: req.id,
      usuarioId: req.user._id.toString(),
      materiaId: materia,
      estado,
    });

    res.json(toPublicHistorial(doc));
  } catch (err) {
    next(err);
  }
};
