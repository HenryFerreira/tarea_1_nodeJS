// Importamos utilidades de Mongoose y bcrypt.
// - Schema/model: para definir el modelo y exportarlo
// - bcrypt: para hashear y validar contraseñas (Para no guardar texto plano)
const { Schema, model } = require('mongoose');
const bcrypt = require('bcrypt');

// Definimos el esquema del usuario.
// timestamps: true agrega createdAt/updatedAt automáticamente.
const UsuarioSchema = new Schema({
  // Email único del usuario. Lo normalizamos:
  // - required: obligatorio
  // - unique: índice único en base
  // - lowercase/trim: limpieza de datos a la entrada
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },

  // passwordHash guarda el hash (resultado de bcrypt), no la contraseña original.
  passwordHash: { type: String, required: true },

  // Nombre visible.
  nombre: { type: String, trim: true },

  // Rol del usuario para control de permisos.
  // Usamos un enum para limitar valores válidos.
  rol: { type: String, enum: ['ESTUDIANTE', 'ADMIN'], default: 'ESTUDIANTE', index: true }
}, { timestamps: true });

/**
 * Método de instancia: compara una contraseña en texto plano
 * contra el hash guardado en este documento.
 * - Devuelve una promesa que resuelve en true/false.
 */
UsuarioSchema.methods.validarPassword = function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

/**
 * Método estático: genera el hash de una contraseña.
 * - Centraliza la política de hash (saltRounds).
 * - Útil en controladores/servicios al crear usuarios.
 */
UsuarioSchema.statics.hashPassword = async function (plain) {
  const saltRounds = 10;
  return bcrypt.hash(plain, saltRounds);
};

// Exportamos el modelo para usarlo en servicios/controladores.
module.exports = model('Usuario', UsuarioSchema);
