// Importamos de Mongoose. Types se usa para ObjectId (refs).
const { Schema, model, Types } = require('mongoose');

/**
 * Subdocumento de Horario:
 * - _id: false evita crear un _id por cada horario embebido.
 * - dia: restringido a abreviaturas.
 * - inicio/fin: como 'HH:mm' simplifica validaciones del lado del servidor.
 */
const HorarioSchema = new Schema({
  dia:   { type: String, enum: ['LUN','MAR','MIE','JUE','VIE','SAB'], required: true },
  inicio:{ type: String, required: true }, // e.g., '18:00'
  fin:   { type: String, required: true }  // e.g., '20:00'
}, { _id: false });

/**
 * Subdocumento de Previa:
 * - tipo: 'CURSO' o 'EXAMEN' para modelar la regla académica.
 * - materia: referencia a otra Materia (previa requerida).
 *   Usamos ref para poder hacer populate por si se necesita nombres/códigos.
 */
const PreviaSchema = new Schema({
  tipo:    { type: String, enum: ['CURSO','EXAMEN'], required: true },
  materia: { type: Types.ObjectId, ref: 'Materia', required: true }
}, { _id: false });

/**
 * Esquema principal de Materia:
 * - codigo: único (clave humana, e.g. "MAT101").
 * - nombre, creditos, semestre: atributos básicos.
 * - horarios: array de HorarioSchema para detectar choques.
 * - previas: array de PreviaSchema para calcular elegibilidad.
 */
const MateriaSchema = new Schema({
  codigo:   { type: String, required: true, unique: true, trim: true },
  nombre:   { type: String, required: true, trim: true },
  creditos: { type: Number, required: true, min: 0 },
  semestre: { type: Number, required: true, min: 1 },
  horarios: { type: [HorarioSchema], default: [] },
  previas:  { type: [PreviaSchema],  default: [] }
}, { timestamps: true });

// Índices útiles para búsquedas y listados:
// - Por semestre (catálogo)
// - Índice de texto para buscar por nombre/código
MateriaSchema.index({ semestre: 1 });
MateriaSchema.index({ nombre: 'text', codigo: 'text' });

// Exportamos el modelo.
module.exports = model('Materia', MateriaSchema);
