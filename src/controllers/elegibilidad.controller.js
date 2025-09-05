/**
 * Controller de Elegibilidad
 * ==========================
 */

const { calcularElegibilidad } = require("../services/elegibilidad.service");
const { logger } = require("../logger/logger");
const bus = require("../events/bus");

exports.getElegibilidad = async (req, res, next) => {
  try {
    // Validación mínima: necesitamos un usuario (viene de requireAuth o devFakeAuth)
    if (!req.user?._id) {
      return res.status(401).json({ error: "No autenticado", reqId: req.id });
    }

    const { semestre } = req.query; // opcional

    const result = await calcularElegibilidad({
      usuarioId: req.user._id,
      semestre: semestre != null ? Number(semestre) : undefined,
    });

    // Log + evento de dominio
    logger.info("Elegibilidad consultada", {
      reqId: req.id,
      userId: req.user._id,
      filtros: { semestre: semestre ?? null },
      elegibles: result.resumen.elegibles,
      total: result.resumen.totalMaterias,
    });
    bus.emit("elegibilidad:consultada", {
      reqId: req.id,
      userId: req.user._id,
      filtros: { semestre: semestre ?? null },
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
};
