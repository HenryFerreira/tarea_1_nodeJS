/**
 * Servicio de Elegibilidad
 * ========================
 * Responsabilidad:
 *  - Evaluar si un usuario está habilitado a cursar cada materia
 *    según sus "previas" y su historial académico.
 *
 * Reglas (según consigna):
 *  - Previa tipo "CURSO"  => se cumple si la previa está en estado CURSADO o APROBADO
 *  - Previa tipo "EXAMEN" => se cumple solo si la previa está en estado APROBADO
 *
 * Además devolvemos "motivos" cuando una materia NO es elegible, para explicar por qué.
 */

const { Types } = require("mongoose");
const Historial = require("../models/historial.model");
const Materia = require("../models/materia.model");

/** Mapea estado -> prioridad de logro */
const LEVEL = { PENDIENTE: 0, EN_CURSO: 1, CURSADO: 2, APROBADO: 3 };

/** Devuelve true si una previa está cumplida dado el estado actual del alumno en esa previa */
function cumplePrevia(previaTipo, estadoPrev) {
  const lvl = LEVEL[estadoPrev || "PENDIENTE"] ?? 0;
  if (previaTipo === "CURSO")  return lvl >= LEVEL.CURSADO; // CURSADO o APROBADO
  if (previaTipo === "EXAMEN") return lvl >= LEVEL.APROBADO; // solo APROBADO
  return false;
}

/**
 * Carga el historial del usuario y devuelve:
 *  - mapEstado: Map<materiaIdString, estado> para lookup O(1)
 *  - raw: array original 
 */
async function loadHistorialMap(usuarioId) {
  const raw = await Historial.find({ usuario: usuarioId })
    .select("materia estado")
    .lean();
  const map = new Map(raw.map(h => [String(h.materia), h.estado]));
  return { mapEstado: map, raw };
}

/**
 * Evalúa una materia contra el estado del usuario:
 *  - Determina si es elegible
 *  - Lista previas cumplidas/no cumplidas
 *  - Agrega motivos cuando no es elegible
 *  - Adjunta info mínima de la materia y el estado del usuario en esa materia
 */
function evaluarMateria(materiaDoc, mapEstadoUsuario) {
  const motivos = [];
  const previasDetalladas = [];

  // Estado del usuario en la "materia objetivo" (puede ser PENDIENTE si no existe)
  const estadoEnMateria = mapEstadoUsuario.get(String(materiaDoc._id)) || "PENDIENTE";

  // Si ya está APROBADA
  if (estadoEnMateria === "APROBADO") {
    motivos.push("La materia ya está APROBADA.");
  }

  // Evaluar cada previa
  for (const p of (materiaDoc.previas || [])) {
    const previaMateriaId = p.materia?._id || p.materia; // soporta populate o ObjectId
    const estadoPrev = mapEstadoUsuario.get(String(previaMateriaId)) || "PENDIENTE";
    const ok = cumplePrevia(p.tipo, estadoPrev);

    previasDetalladas.push({
      tipo: p.tipo,
      materia: p.materia && typeof p.materia === "object"
        ? { _id: p.materia._id, codigo: p.materia.codigo, nombre: p.materia.nombre, semestre: p.materia.semestre }
        : previaMateriaId,
      cumplida: ok,
      estadoActual: estadoPrev,
    });

    if (!ok) {
      if (p.tipo === "CURSO")  motivos.push(`Falta CURSAR/APROBAR la previa: ${p.materia?.codigo || previaMateriaId}`);
      if (p.tipo === "EXAMEN") motivos.push(`Falta APROBAR EXAMEN de la previa: ${p.materia?.codigo || previaMateriaId}`);
    }
  }

  const elegible = motivos.length === 0;

  return {
    materia: {
      _id: materiaDoc._id,
      codigo: materiaDoc.codigo,
      nombre: materiaDoc.nombre,
      semestre: materiaDoc.semestre,
      creditos: materiaDoc.creditos,
    },
    estadoActual: estadoEnMateria, // estado del usuario respecto de ESTA materia
    elegible,
    motivos,                       // vacío si es elegible
    previas: previasDetalladas,    // detalle por cada previa
  };
}

/**
 * Punto de entrada principal del servicio.
 * - Filtra por semestre si se indica.
 * - Hace populate mínimo de previas para armar mensajes claros.
 * - Devuelve resumen y detalle por materia.
 */
async function calcularElegibilidad({ usuarioId, semestre }) {
  if (!Types.ObjectId.isValid(usuarioId)) {
    throw new Error("usuarioId inválido");
  }

  const { mapEstado } = await loadHistorialMap(usuarioId);

  const query = {};
  if (semestre != null) query.semestre = Number(semestre);

  const materias = await Materia.find(query)
    .populate("previas.materia", "codigo nombre semestre") // mínimo para motivos entendibles
    .sort({ semestre: 1, codigo: 1 })
    .lean();

  const items = materias.map(m => evaluarMateria(m, mapEstado));
  const resumen = {
    totalMaterias: items.length,
    elegibles: items.filter(i => i.elegible).length,
    noElegibles: items.filter(i => !i.elegible).length,
  };

  return { resumen, items };
}

module.exports = {
  calcularElegibilidad,
  // exporto helpers por si querés test unitarios
  cumplePrevia,
  evaluarMateria,
};
