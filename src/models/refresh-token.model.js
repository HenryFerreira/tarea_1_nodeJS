// Modelo para administrar Refresh Tokens (rotación/blacklist).
// Mantiene control fino de sesiones (por dispositivo/IP).
const { Schema, model, Types } = require('mongoose');

const RefreshTokenSchema = new Schema({
  // Quién es el dueño del token.
  usuario:   { type: Types.ObjectId, ref: 'Usuario', required: true, index: true },

  // El token en sí (string firmado/aleatorio).
  token:     { type: String, required: true, unique: true },

  // Momento de expiración calculado al emitirlo (p.ej., +7 días).
  expiraEn:  { type: Date, required: true },

  // Si se revoca antes de expirar (logout, robo, etc.), guardamos cuándo.
  revocadoEn:{ type: Date },

  // Metadatos útiles.
  userAgent: String,
  ip:        String
}, { timestamps: true });

/**
 * Método de instancia:
 * - Devuelve true si el token no está revocado y todavía no expiró.
 * - Útil en el endpoint /refresh para validar si puede emitirse un nuevo access token.
 */
RefreshTokenSchema.methods.estaVigente = function () {
  return !this.revocadoEn && this.expiraEn > new Date();
};

module.exports = model('RefreshToken', RefreshTokenSchema);
