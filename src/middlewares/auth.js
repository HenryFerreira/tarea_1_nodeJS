/**
 * Middlewares de Autenticación y Autorización
 * ===========================================
 * - requireAuth:
 *    * Extrae el Access Token del request (Authorization: Bearer ...)
 *    * Verifica firma y expiración (JWT_ACCESS_SECRET)
 *    * Inyecta un user mínimo en req.user para el resto de la app
 *
 * - requireRole(role):
 *    * Revisa que req.user exista (o sea, que haya pasado requireAuth)
 *    * Valida que el rol del usuario coincida con el requerido
 *
 * Buenas prácticas:
 * - Access Token corto (ej.: 15m) y Refresh Token más largo (ej.: 7d)
 */

const jwt = require("jsonwebtoken");
const { logger } = require("../logger/logger");

/**
 * Helper: busca el access token en lugares típicos.
 * Orden de búsqueda:
 *  - Authorization: Bearer <token> (estándar HTTP)
 *  - x-access-token (cabecera auxiliar para pruebas)
 *  - cookie accessToken
 */
function getAccessToken(req) {
  const h = req.headers.authorization || req.headers.Authorization;
  if (h && h.startsWith("Bearer ")) return h.substring(7);
  if (req.headers["x-access-token"]) return req.headers["x-access-token"];
  if (req.cookies?.accessToken) return req.cookies.accessToken;
  return null;
}

/**
 * requireAuth: middleware que protege rutas.
 * - Si no hay token o es inválido, responde 401.
 * - Si es válido, setea req.user con { _id, rol, email } para el resto de la cadena.
 */
exports.requireAuth = (req, res, next) => {
  try {
    const token = getAccessToken(req);
    if (!token) return res.status(401).json({ error: "No autenticado", reqId: req.id });

    // Verifica firma y expiración contra JWT_ACCESS_SECRET
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    // Inyectamos un "perfil" mínimo. Podrías cargar más datos desde DB si lo necesitás.
    req.user = { _id: payload.sub, rol: payload.rol, email: payload.email };
    next();
  } catch (err) {
    logger.warn("Access token inválido", { reqId: req.id, err: err?.message });
    return res.status(401).json({ error: "Token inválido o expirado", reqId: req.id });
  }
};

/**
 * requireRole('ADMIN' | 'ESTUDIANTE'): middleware de autorización.
 * - Requiere que el usuario ya esté autenticado (req.user exista).
 * - Compara el rol del usuario con el requerido por la ruta.
 */
exports.requireRole = (role) => (req, res, next) => {
  if (!req.user?.rol) return res.status(401).json({ error: "No autenticado", reqId: req.id });
  if (req.user.rol !== role) {
    return res.status(403).json({ error: "No autorizado", reqId: req.id });
  }
  next();
};
