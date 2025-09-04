const { Types } = require("mongoose");
const Historial = require("../models/historial.model");
const bus = require("../events/bus");
const { logger } = require("../logger/logger");

// POST /api/historial
exports.historial_create = async (req, res, next) => {
  try {
    const { usuario, materia, estado, notaExamen, fecha } = req.body;

    const historial = await Historial.create({
      usuario, materia, estado, notaExamen, fecha
    });

    // Evento de dominio (lo capturás en index.js con bus.on(...))
    bus.emit("historial:actualizado", {
      reqId: req.id,
      usuarioId: historial.usuario.toString(),
      materiaId: historial.materia.toString(),
      estado: historial.estado,
    });

    // Log app (nivel info)
    logger.info("Historial creado", {
      reqId: req.id,
      historialId: historial._id.toString()
    });

    res.status(201).json({ mensaje: "Historial creado", historial });
  } catch (err) {
    next(err);
  }
};

// GET /api/historial
exports.historial_list = async (req, res, next) => {
  try {
    const historiales = await Historial.find()
      .populate("usuario")
      .populate("materia");

    logger.info("Historial listado", { reqId: req.id, count: historiales.length });
    res.json(historiales);
  } catch (err) {
    next(err);
  }
};

// GET /api/historial/usuario/:idUsuario
exports.historial_by_usuario = async (req, res, next) => {
  try {
    const { idUsuario } = req.params;
    if (!Types.ObjectId.isValid(idUsuario)) {
      return res.status(400).json({ error: "idUsuario inválido", reqId: req.id });
    }

    const historiales = await Historial.find({ usuario: idUsuario })
      .populate("materia");

    logger.info("Historial por usuario", { reqId: req.id, idUsuario, count: historiales.length });
    res.json(historiales);
  } catch (err) {
    next(err);
  }
};

// POST /api/historial/upsert  (requiere req.user en auth)
exports.upsertHistorial = async (req, res, next) => {
  try {
    const { materia, estado, notaExamen, fecha } = req.body;

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
      estado
    });

    res.json(doc);
  } catch (err) {
    next(err);
  }
};
