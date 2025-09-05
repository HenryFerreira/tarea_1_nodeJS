/**
 * devFakeAuth (SOLO DESARROLLO)
 * =============================
 * Inyecta un req.user de prueba para poder usar endpoints que requieren
 * usuario autenticado (p.ej. /historial/upsert) sin tener login todavía.
 *
 * ¿Cómo funciona?
 * - Si NODE_ENV === 'production' -> NO hace nada (se desactiva por seguridad).
 * - Si DEV_FAKE_AUTH !== '1'      -> NO hace nada (opt-in explícito).
 * - Si está activo, intenta obtener el user así (en este orden):
 *    1) Encabezados:   x-dev-user-id, x-dev-user-rol (útil para Postman/cURL)
 *    2) Variables env: DEV_FAKE_USER_ID, DEV_FAKE_USER_ROLE
 *
 * Uso:
 * - Activalo escribiendo en tu .env:
 *      DEV_FAKE_AUTH=1
 *      DEV_FAKE_USER_ID=<ObjectId de un usuario real>
 *      DEV_FAKE_USER_ROLE=ESTUDIANTE
 * - O bien, enviando headers en cada request:
 *      -H "x-dev-user-id: <ObjectId>" -H "x-dev-user-rol: ESTUDIANTE"
 *
 * IMPORTANTE:
 * - Lo desactivamos automáticamente si
 *   NODE_ENV === 'production'.
 */

const { logger } = require("../logger/logger");

module.exports = function devFakeAuth() {
  let warnedOnce = false;

  return (req, res, next) => {
    const isProd = process.env.NODE_ENV === "production";
    const enabled = process.env.DEV_FAKE_AUTH === "1";

    if (isProd || !enabled) return next(); // apagado en prod o si no está habilitado

    // 1) Headers (prioridad para pruebas dinámicas)
    const headerUserId = req.headers["x-dev-user-id"];
    const headerRole = req.headers["x-dev-user-rol"];

    // 2) Variables de entorno (fallback)
    const envUserId = process.env.DEV_FAKE_USER_ID;
    const envRole = process.env.DEV_FAKE_USER_ROLE || "ESTUDIANTE";

    const userId = headerUserId || envUserId;
    const rol = headerRole || envRole;

    if (userId) {
      req.user = { _id: userId, rol };
      res.locals.user = req.user;

      if (!warnedOnce) {
        logger.warn("devFakeAuth ACTIVO (solo DEV). Inyectando req.user desde headers/env.", {
          reqId: req.id,
          userId,
          rol,
        });
        warnedOnce = true;
      }
    } else if (!warnedOnce) {
      logger.warn("devFakeAuth activo, pero sin DEV_FAKE_USER_ID ni x-dev-user-id. req.user no seteado.", {
        reqId: req.id,
      });
      warnedOnce = true;
    }

    next();
  };
};
