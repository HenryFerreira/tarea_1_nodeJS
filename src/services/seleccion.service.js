/**
 * Servicio de Selección y Choques de Horario
 * ==========================================
 * Responsabilidad:
 *  - Dada una lista de materias seleccionadas (IDs), verificar:
 *      * Elegibilidad del usuario (según previas)
 *      * Choques de horario por día y rango HH:mm
 *      * Carga horaria total (horas)
 *
 * Notas:
 *  - Reutilizamos la lógica de elegibilidad importando helpers del servicio existente.
 *  - No mutamos documentos; solo calculamos y devolvemos un informe.
 */

const { Types } = require("mongoose");
const Materia = require("../models/materia.model");
const Historial = require("../models/historial.model");
const { evaluarMateria } = require("./elegibilidad.service"); // ya lo exportamos antes
const { findDayConflicts, horasDesdeHorarios } = require("../utils/horario.util");

/** Carga un Map<materiaId, estado> con el historial del usuario (lookup O(1)) */
async function loadHistorialMap(usuarioId) {
  const hs = await Historial.find({ usuario: usuarioId }).select("materia estado").lean();
  return new Map(hs.map(h => [String(h.materia), h.estado]));
}

/**
 * Verifica selección:
 *  - materiaIds: array de ObjectId (string)
 *  - usuarioId: ObjectId del alumno
 * Devuelve:
 *  {
 *    resumen: { seleccionadas, elegibles, noElegibles, conflictos, cargaHoras },
 *    conflictos: [ { dia, a:{...}, b:{...}, solapeMinutos, solape } ],
 *    materias: [
 *      {
 *        materia: { _id,codigo,nombre,semestre,creditos },
 *        estadoActual,
 *        elegible,
 *        motivos,
 *        previas: [ { tipo, materia:{...}, cumplida, estadoActual } ],
 *        horarios: [ ... ],
 *        cargaHorasMateria
 *      }
 *    ]
 *  }
 */
async function verificarSeleccion({ materiaIds, usuarioId }) {
  // Validaciones básicas
  if (!Array.isArray(materiaIds) || materiaIds.length === 0) {
    throw new Error("materiaIds requerido (array no vacío)");
  }
  if (!Types.ObjectId.isValid(usuarioId)) {
    throw new Error("usuarioId inválido");
  }

  // Normalizamos IDs (únicos)
  const ids = [...new Set(materiaIds)].filter(Types.ObjectId.isValid);
  if (ids.length === 0) throw new Error("materiaIds inválidos");

  // Cargamos materias seleccionadas + previas para evaluar elegibilidad
  const materias = await Materia.find({ _id: { $in: ids } })
    .populate("previas.materia", "codigo nombre semestre")
    .lean();

  // Historial del usuario para evaluar previas/estado
  const mapEstadoUsuario = await loadHistorialMap(usuarioId);

  // Evaluación materia por materia (elegibilidad + carga horaria)
  const detalladas = materias.map(m => {
    const evalRes = evaluarMateria(m, mapEstadoUsuario);
    const cargaHorasMateria = horasDesdeHorarios(m.horarios || []);
    return {
      ...evalRes,
      horarios: m.horarios || [],
      cargaHorasMateria,
    };
  });

  // Armar slots por día para detectar choques entre TODAS las seleccionadas
  const dayBuckets = new Map(); // dia -> array de slots
  for (const det of detalladas) {
    const { materia } = det;
    for (const h of det.horarios) {
      const arr = dayBuckets.get(h.dia) || [];
      arr.push({
        materia: materia._id,
        codigo: materia.codigo,
        nombre: materia.nombre,
        dia: h.dia,
        inicio: h.inicio,
        fin: h.fin,
      });
      dayBuckets.set(h.dia, arr);
    }
  }

  // Buscar conflictos por día
  const conflictos = [];
  for (const [dia, slots] of dayBuckets.entries()) {
    conflictos.push(...findDayConflicts(slots));
  }

  // Resumen
  const seleccionadas = detalladas.length;
  const elegibles = detalladas.filter(x => x.elegible).length;
  const noElegibles = seleccionadas - elegibles;
  const cargaHoras = Math.round(
    detalladas.reduce((acc, x) => acc + x.cargaHorasMateria, 0) * 100
  ) / 100;

  return {
    resumen: { seleccionadas, elegibles, noElegibles, conflictos: conflictos.length, cargaHoras },
    conflictos,
    materias: detalladas,
  };
}

module.exports = { verificarSeleccion };
