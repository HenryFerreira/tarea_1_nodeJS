/**
 * Controlador de Materias
 * - CRUD + gestión de previas y horarios con buenas prácticas:
 *   * Validación de ObjectId y de formato de horarios (HH:mm)
 *   * Manejo de E11000 (código duplicado)
 *   * Logs (winston) con reqId para correlación
 *   * Eventos de dominio (bus.emit) para auditoría/tiempo real
 *   * Populate selectivo al consultar (previas.materia)
 */
const { Types } = require("mongoose");
const Materia = require("../models/materia.model");
const { logger } = require("../logger/logger");
const bus = require("../events/bus");

// --- Helpers ---

const DIAS = new Set(["LUN","MAR","MIE","JUE","VIE","SAB"]);
const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

function isHHMM(s) { return typeof s === "string" && HHMM.test(s); }
function toMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
function horarioValido({ dia, inicio, fin }) {
  if (!DIAS.has(dia)) return false;
  if (!isHHMM(inicio) || !isHHMM(fin)) return false;
  return toMinutes(inicio) < toMinutes(fin);
}

// Populate consistente para previas.materia
const populatePrevias = (q) =>
  q.populate({ path: "previas.materia", select: "codigo nombre semestre" });

// Serializador público: salida estable para el front
function toPublicMateria(m) {
  const previas = (m.previas || []).map((p) => {
    const mm = p.materia;
    return {
      tipo: p.tipo,
      // siempre devolvemos un id en "materia"
      materia: mm && mm._id ? mm._id : mm,
      // y si vino poblado, sumamos nombre/código
      materiaNombre: mm && mm.nombre ? mm.nombre : undefined,
      materiaCodigo: mm && mm.codigo ? mm.codigo : undefined,
    };
  });

  return {
    _id: m._id,
    codigo: m.codigo,
    nombre: m.nombre,
    creditos: m.creditos,
    semestre: m.semestre,
    horarios: m.horarios || [],
    previas,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  };
}

/**
 * POST /api/materias
 * Crea una materia.
 * body: { codigo, nombre, creditos, semestre, horarios?:[], previas?:[] }
 */
exports.materia_create = async (req, res, next) => {
  try {
    const { codigo, nombre, creditos, semestre, horarios = [], previas = [] } = req.body;

    if (!codigo || !nombre || creditos == null || semestre == null) {
      return res.status(400).json({ error: "codigo, nombre, creditos y semestre son requeridos", reqId: req.id });
    }
    // Validar horarios
    for (const h of horarios) {
      if (!horarioValido(h)) {
        return res.status(400).json({ error: "Horario inválido (dia|HH:mm|rango)", reqId: req.id, detalle: h });
      }
    }
    // Validar previas
    for (const p of previas) {
      if (!["CURSO","EXAMEN"].includes(p.tipo) || !Types.ObjectId.isValid(p.materia)) {
        return res.status(400).json({ error: "Previa inválida (tipo|materia)", reqId: req.id, detalle: p });
      }
    }

    const doc = await Materia.create({ codigo, nombre, creditos, semestre, horarios, previas });
    await doc.populate({ path: "previas.materia", select: "codigo nombre semestre" });

    bus.emit("materia:creada", { reqId: req.id, materiaId: doc._id.toString(), codigo: doc.codigo });
    logger.info("Materia creada", { reqId: req.id, materiaId: doc._id.toString(), codigo: doc.codigo });

    res.status(201).json(toPublicMateria(doc));
  } catch (err) {
    if (err?.code === 11000) {
      logger.warn("Código de materia duplicado", { reqId: req.id, codigo: req.body?.codigo });
      return res.status(409).json({ error: "El código de la materia ya existe", reqId: req.id });
    }
    next(err);
  }
};

/**
 * GET /api/materias
 * Lista materias con filtros básicos y búsqueda.
 * query: ?q=texto&semestre=2&limit=20&page=1
 */
exports.materia_list = async (req, res, next) => {
  try {
    const { q, semestre, limit = 50, page = 1 } = req.query;

    const query = {};
    if (semestre) query.semestre = Number(semestre);

    let projection = undefined;
    let sort = { semestre: 1, codigo: 1 };

    if (q && q.trim()) {
      query.$text = { $search: q.trim() }; // TOP-LEVEL
      projection = { score: { $meta: "textScore" } };
      sort = { score: { $meta: "textScore" }, semestre: 1, codigo: 1 };
    }

    const perPage = Math.min(Number(limit) || 50, 100);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * perPage;

    const baseFind = Materia.find(query, projection).sort(sort).skip(skip).limit(perPage);
    const [items, total] = await Promise.all([
      populatePrevias(baseFind).lean(),
      Materia.countDocuments(query),
    ]);

    res.json({
      total,
      page: Number(page) || 1,
      limit: perPage,
      items: items.map(toPublicMateria),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/materias/:id
 * Obtiene una materia por ID (con previas pobladas mínimamente).
 */
exports.materia_by_id = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "ID inválido", reqId: req.id });
    }

    const doc = await populatePrevias(Materia.findById(id)).lean();
    if (!doc) {
      return res.status(404).json({ error: "Materia no encontrada", reqId: req.id });
    }

    logger.info("Materia consultada", { reqId: req.id, materiaId: id });
    res.json(toPublicMateria(doc));
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/materias/:id
 * Actualiza campos de la materia y opcionalmente reemplaza horarios/previas completas.
 * body: { codigo?, nombre?, creditos?, semestre?, horarios?, previas? }
 */
exports.materia_update = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "ID inválido", reqId: req.id });
    }

    const doc = await Materia.findById(id);
    if (!doc) {
      return res.status(404).json({ error: "Materia no encontrada", reqId: req.id });
    }

    const { codigo, nombre, creditos, semestre, horarios, previas } = req.body;

    if (codigo) doc.codigo = String(codigo).trim();
    if (typeof nombre === "string") doc.nombre = nombre.trim();
    if (creditos != null) doc.creditos = Number(creditos);
    if (semestre != null) doc.semestre = Number(semestre);

    if (Array.isArray(horarios)) {
      for (const h of horarios) {
        if (!horarioValido(h)) {
          return res.status(400).json({ error: "Horario inválido (dia|HH:mm|rango)", reqId: req.id, detalle: h });
        }
      }
      doc.horarios = horarios;
    }

    if (Array.isArray(previas)) {
      for (const p of previas) {
        if (!["CURSO","EXAMEN"].includes(p.tipo) || !Types.ObjectId.isValid(p.materia)) {
          return res.status(400).json({ error: "Previa inválida (tipo|materia)", reqId: req.id, detalle: p });
        }
      }
      doc.previas = previas;
    }

    await doc.save();
    await doc.populate({ path: "previas.materia", select: "codigo nombre semestre" });

    bus.emit("materia:actualizada", { reqId: req.id, materiaId: doc._id.toString(), cambios: Object.keys(req.body) });
    logger.info("Materia actualizada", { reqId: req.id, materiaId: doc._id.toString(), cambios: Object.keys(req.body) });

    res.json(toPublicMateria(doc));
  } catch (err) {
    if (err?.code === 11000) {
      logger.warn("Intento de actualizar con código duplicado", { reqId: req.id, codigo: req.body?.codigo });
      return res.status(409).json({ error: "El código de la materia ya existe", reqId: req.id });
    }
    next(err);
  }
};

/**
 * DELETE /api/materias/:id
 * Elimina la materia.
 */
exports.materia_delete = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "ID inválido", reqId: req.id });
    }

    const doc = await Materia.findByIdAndDelete(id);
    if (!doc) {
      return res.status(404).json({ error: "Materia no encontrada", reqId: req.id });
    }

    bus.emit("materia:eliminada", { reqId: req.id, materiaId: doc._id.toString(), codigo: doc.codigo });
    logger.info("Materia eliminada", { reqId: req.id, materiaId: doc._id.toString(), codigo: doc.codigo });

    // Aunque está eliminada, devolvemos su representación pública (sin populate ya no hace falta)
    res.json({ ok: true, eliminado: toPublicMateria(doc) });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/materias/:id/previas
 * Agrega una previa (no duplica si ya existe la misma combinación tipo+materia).
 * body: { tipo:'CURSO'|'EXAMEN', materiaPreviaId:ObjectId }
 */
exports.materia_add_previa = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { tipo, materiaPreviaId } = req.body;

    if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(materiaPreviaId)) {
      return res.status(400).json({ error: "ID inválido", reqId: req.id });
    }
    if (!["CURSO","EXAMEN"].includes(tipo)) {
      return res.status(400).json({ error: "tipo de previa inválido", reqId: req.id });
    }
    if (id === materiaPreviaId) {
      return res.status(400).json({ error: "Una materia no puede ser previa de sí misma", reqId: req.id });
    }

    const doc = await Materia.findById(id);
    if (!doc) return res.status(404).json({ error: "Materia no encontrada", reqId: req.id });

    const exists = doc.previas.some(p => p.tipo === tipo && String(p.materia) === String(materiaPreviaId));
    if (!exists) {
      doc.previas.push({ tipo, materia: materiaPreviaId });
      await doc.save();
    }

    await doc.populate({ path: "previas.materia", select: "codigo nombre semestre" });

    bus.emit("materia:previa_agregada", { reqId: req.id, materiaId: id, previaTipo: tipo, previaMateriaId: materiaPreviaId });
    logger.info("Previa agregada", { reqId: req.id, materiaId: id, tipo, previa: materiaPreviaId });

    res.json(toPublicMateria(doc));
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/materias/:id/previas
 * Elimina una previa por combinación (tipo + materia).
 * body: { tipo:'CURSO'|'EXAMEN', materiaPreviaId:ObjectId }
 */
exports.materia_remove_previa = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { tipo, materiaPreviaId } = req.body;

    if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(materiaPreviaId)) {
      return res.status(400).json({ error: "ID inválido", reqId: req.id });
    }
    if (!["CURSO","EXAMEN"].includes(tipo)) {
      return res.status(400).json({ error: "tipo de previa inválido", reqId: req.id });
    }

    const doc = await Materia.findById(id);
    if (!doc) return res.status(404).json({ error: "Materia no encontrada", reqId: req.id });

    const prevCount = doc.previas.length;
    doc.previas = doc.previas.filter(p => !(p.tipo === tipo && String(p.materia) === String(materiaPreviaId)));
    if (doc.previas.length !== prevCount) {
      await doc.save();
      bus.emit("materia:previa_eliminada", { reqId: req.id, materiaId: id, previaTipo: tipo, previaMateriaId: materiaPreviaId });
      logger.info("Previa eliminada", { reqId: req.id, materiaId: id, tipo, previa: materiaPreviaId });
    }

    await doc.populate({ path: "previas.materia", select: "codigo nombre semestre" });

    res.json(toPublicMateria(doc));
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/materias/:id/horarios
 * Agrega un horario (evita duplicados exactos).
 * body: { dia:'LUN'|'MAR'|..., inicio:'HH:mm', fin:'HH:mm' }
 */
exports.materia_add_horario = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { dia, inicio, fin } = req.body;

    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "ID inválido", reqId: req.id });
    }
    const h = { dia, inicio, fin };
    if (!horarioValido(h)) {
      return res.status(400).json({ error: "Horario inválido (dia|HH:mm|rango)", reqId: req.id, detalle: h });
    }

    const doc = await Materia.findById(id);
    if (!doc) return res.status(404).json({ error: "Materia no encontrada", reqId: req.id });

    const exists = doc.horarios.some(x => x.dia === dia && x.inicio === inicio && x.fin === fin);
    if (!exists) {
      doc.horarios.push(h);
      await doc.save();
    }

    await doc.populate({ path: "previas.materia", select: "codigo nombre semestre" });

    bus.emit("materia:horario_agregado", { reqId: req.id, materiaId: id, horario: h });
    logger.info("Horario agregado", { reqId: req.id, materiaId: id, horario: h });

    res.json(toPublicMateria(doc));
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/materias/:id/horarios
 * Elimina un horario exacto por coincidencia.
 * body: { dia:'LUN'|'MAR'|..., inicio:'HH:mm', fin:'HH:mm' }
 */
exports.materia_remove_horario = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { dia, inicio, fin } = req.body;

    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "ID inválido", reqId: req.id });
    }
    const h = { dia, inicio, fin };
    if (!horarioValido(h)) {
      return res.status(400).json({ error: "Horario inválido (dia|HH:mm|rango)", reqId: req.id, detalle: h });
    }

    const doc = await Materia.findById(id);
    if (!doc) return res.status(404).json({ error: "Materia no encontrada", reqId: req.id });

    const before = doc.horarios.length;
    doc.horarios = doc.horarios.filter(x => !(x.dia === dia && x.inicio === inicio && x.fin === fin));
    if (doc.horarios.length !== before) {
      await doc.save();
      bus.emit("materia:horario_eliminado", { reqId: req.id, materiaId: id, horario: h });
      logger.info("Horario eliminado", { reqId: req.id, materiaId: id, horario: h });
    }

    await doc.populate({ path: "previas.materia", select: "codigo nombre semestre" });

    res.json(toPublicMateria(doc));
  } catch (err) {
    next(err);
  }
};
