/**
 * Utils de Horarios
 * =================
 * Funciones puras para:
 *  - Validar formato HH:mm
 *  - Convertir HH:mm ↔ minutos
 *  - Detectar solapes entre intervalos del mismo día
 *  - Calcular carga horaria (en horas) a partir de horarios
 */

const DIAS = new Set(["LUN","MAR","MIE","JUE","VIE","SAB"]);
const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

function isDia(d) { return DIAS.has(d); }
function isHHMM(s) { return typeof s === "string" && HHMM.test(s); }

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function toHHMM(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
}

/**
 * Devuelve true si dos intervalos [aInicio, aFin) y [bInicio, bFin) se solapan
 * Regla: max(inicio) < min(fin)
 */
function intervalsOverlap(aInicio, aFin, bInicio, bFin) {
  return Math.max(aInicio, bInicio) < Math.min(aFin, bFin);
}

/**
 * Detecta solapes entre horarios de distintas materias en el MISMO DÍA.
 * - Entrada: array de objetos { materia, codigo, nombre, dia, inicio, fin }
 * - Salida: array de conflictos, cada uno con:
 *      { dia, a:{materia,codigo,nombre,inicio,fin}, b:{...}, solapeMinutos }
 */
function findDayConflicts(daySlots) {
  // Ordenamos por inicio para comparar vecinos eficientemente
  const slots = [...daySlots].sort((x,y) => toMinutes(x.inicio) - toMinutes(y.inicio));
  const conflicts = [];

  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const A = slots[i], B = slots[j];
      const a1 = toMinutes(A.inicio), a2 = toMinutes(A.fin);
      const b1 = toMinutes(B.inicio), b2 = toMinutes(B.fin);
      if (intervalsOverlap(a1, a2, b1, b2)) {
        const overlapStart = Math.max(a1, b1);
        const overlapEnd   = Math.min(a2, b2);
        conflicts.push({
          dia: A.dia,
          a: { materia: A.materia, codigo: A.codigo, nombre: A.nombre, inicio: A.inicio, fin: A.fin },
          b: { materia: B.materia, codigo: B.codigo, nombre: B.nombre, inicio: B.inicio, fin: B.fin },
          solapeMinutos: overlapEnd - overlapStart,
          solape: `${toHHMM(overlapStart)}–${toHHMM(overlapEnd)}`,
        });
      } else {
        // slots están ordenados; si B empieza después de que A termina y no solapan,
        // para siguientes B (más tarde) tampoco solapará con A → podemos cortar el loop interno
        if (b1 >= a2) break;
      }
    }
  }
  return conflicts;
}

/**
 * Calcula carga horaria total (en horas decimales) de un conjunto de horarios.
 * - Entrada: array de { inicio:'HH:mm', fin:'HH:mm' }
 * - Salida: número en horas, con 2 decimales (ej. 5.5)
 */
function horasDesdeHorarios(horarios) {
  const totalMins = (horarios || []).reduce((acc, h) => acc + (toMinutes(h.fin) - toMinutes(h.inicio)), 0);
  return Math.round((totalMins / 60) * 100) / 100;
}

module.exports = {
  DIAS,
  isDia,
  isHHMM,
  toMinutes,
  toHHMM,
  intervalsOverlap,
  findDayConflicts,
  horasDesdeHorarios,
};
