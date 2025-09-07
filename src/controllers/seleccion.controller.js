/**
 * Controller de Selección / Choques
 * =================================
 * POST /seleccion/verificar
 * body: { materias: [ "<ObjectId>", ... ] }
 *
 * Requisitos:
 *  - req.user._id (usar requireAuth o devFakeAuth en desarrollo)
 *
 * Respuesta: ver formato en el servicio (resumen, conflictos, materias[])
 */

const { verificarSeleccion } = require("../services/seleccion.service");
const { logger } = require("../logger/logger");
const bus = require("../events/bus");

exports.verificar = async (req, res, next) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ error: "No autenticado", reqId: req.id });
    }
    const { materias } = req.body;

    const result = await verificarSeleccion({
      materiaIds: materias,
      usuarioId: req.user._id,
    });

    logger.info("Seleccion verificada", {
      reqId: req.id,
      userId: req.user._id,
      seleccionadas: result.resumen.seleccionadas,
      conflictos: result.resumen.conflictos,
      cargaHoras: result.resumen.cargaHoras,
    });

    bus.emit("seleccion:verificada", {
      reqId: req.id,
      userId: req.user._id,
      resumen: result.resumen,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
};
