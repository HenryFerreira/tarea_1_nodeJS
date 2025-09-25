// Historial registra el estado del alumno respecto a cada Materia.
const { Schema, model, Types } = require('mongoose');

const HistorialSchema = new Schema({
  // Usuario dueño del historial.
  usuario: { type: Types.ObjectId, ref: 'Usuario', required: true, index: true },

  // Materia concreta a la que se refiere el registro.
  materia: { type: Types.ObjectId, ref: 'Materia', required: true, index: true },

  // Estado académico:
  // - PENDIENTE: aún no cursó.
  // - EN_CURSO: la está cursando.
  // - CURSADO: curso aprobado (sin examen final aprobado).
  // - A_EXAMEN: ya cursó y está en instancia de examen.
  // - APROBADO: aprobó examen final (o equivalente).
  estado: { 
    type: String, 
    enum: ['PENDIENTE','EN_CURSO','CURSADO','A_EXAMEN','APROBADO'], 
    required: true,
    default: 'PENDIENTE'
  },

  // Nota de examen (si aplica).
  notaExamen: { type: Number, min: 0, max: 12 },

  // Fecha asociada al hito (cierre de curso, fecha de examen, etc.).
  fecha: { type: Date }
}, { timestamps: true });

// Un alumno no debería tener dos filas para la misma materia.
// Este índice compuesto lo garantiza a nivel de base.
HistorialSchema.index({ usuario: 1, materia: 1 }, { unique: true });

// Exportamos el modelo.
module.exports = model('Historial', HistorialSchema);
