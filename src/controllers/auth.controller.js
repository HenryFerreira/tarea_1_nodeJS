/**
 * Controlador de Autenticación
 * ============================
 * Conceptos clave:
 * - Access Token (corto): se usa para acceder a rutas protegidas.
 * - Refresh Token (largo): sirve para pedir un nuevo Access sin loguearse de nuevo.
 * - Rotación de refresh: invalida el refresh anterior y emite uno nuevo al refrescar.
 */

const jwt = require("jsonwebtoken");
const Usuario = require("../models/usuario.model");
const RefreshToken = require("../models/refresh-token.model");
const { logger } = require("../logger/logger");
const bus = require("../events/bus");

/**
 * Genera un Access Token con datos mínimos:
 *  - sub: id del usuario (estándar JWT "subject")
 *  - rol, email: para autorización/UX del lado del cliente
 * El TTL se toma de env (JWT_ACCESS_TTL), ej.: "15m"
 */
function signAccessToken(user) {
  const payload = { sub: user._id.toString(), rol: user.rol, email: user.email };
  const token = jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_TTL || "15m",
  });
  const { exp } = jwt.decode(token); // tiempo de expiración (segundos desde epoch)
  return { token, exp };
}

/**
 * Genera un Refresh Token (más largo).
 * - Incluye "type: refresh" para evitar confusiones con access tokens.
 * - TTL desde env (JWT_REFRESH_TTL), ej.: "7d"
 */
function signRefreshToken(user) {
  const payload = { sub: user._id.toString(), type: "refresh" };
  const token = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_TTL || "7d",
  });
  const { exp } = jwt.decode(token);
  return { token, exp };
}

/**
 * Persiste el refresh token en DB.
 * - Almacena expiración, userAgent e IP (útil para auditoría y sesiones por dispositivo).
 */
async function persistRefreshToken({ user, token, exp, req }) {
  const doc = await RefreshToken.create({
    usuario: user._id,
    token,
    expiraEn: new Date(exp * 1000),
    userAgent: req.headers["user-agent"],
    ip: req.headers["x-forwarded-for"] || req.socket?.remoteAddress,
  });
  return doc;
}

/**
 * Helper para encontrar el refresh token en el request.
 * - Puede venir en el body, header o cookie.
 */
function getRefreshFromReq(req) {
  return (
    req.body?.refreshToken ||
    req.headers["x-refresh-token"] ||
    req.cookies?.refreshToken ||
    null
  );
}

/**
 * POST /auth/register
 * Crea un usuario, lo "loguea" automáticamente y devuelve tokens.
 * body: { email, password, nombre?, rol? }
 */
exports.auth_register = async (req, res, next) => {
  try {
    const { email, password, nombre, rol } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "email y password son requeridos", reqId: req.id });
    }

    // Hash de contraseña con helper del modelo
    const passwordHash = await Usuario.hashPassword(password);
    const user = await Usuario.create({ email, passwordHash, nombre, rol });

    // Emitimos ambos tokens
    const { token: accessToken, exp: accessExp } = signAccessToken(user);
    const { token: refreshToken, exp: refreshExp } = signRefreshToken(user);
    await persistRefreshToken({ user, token: refreshToken, exp: refreshExp, req });

    // Eventos y logs
    bus.emit("auth:register", { reqId: req.id, userId: user._id.toString(), email: user.email });
    logger.info("Usuario registrado", { reqId: req.id, userId: user._id.toString(), email: user.email });

    // Nunca devolver passwordHash
    res.status(201).json({
      user: { _id: user._id, email: user.email, nombre: user.nombre, rol: user.rol },
      accessToken,
      accessExp,
      refreshToken,
    });
  } catch (err) {
    // 11000: índice único de email (duplicado)
    if (err?.code === 11000) {
      logger.warn("Registro con email duplicado", { reqId: req.id, email: req.body?.email });
      return res.status(409).json({ error: "El email ya está registrado", reqId: req.id });
    }
    next(err);
  }
};

/**
 * POST /auth/login
 * Valida credenciales y devuelve Access + Refresh.
 * body: { email, password }
 */
exports.auth_login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "email y password son requeridos", reqId: req.id });
    }

    const user = await Usuario.findOne({ email });
    // validarPassword usa bcrypt.compare
    if (!user || !(await user.validarPassword(password))) {
      logger.warn("Login inválido", { reqId: req.id, email });
      return res.status(401).json({ error: "Credenciales inválidas", reqId: req.id });
    }

    const { token: accessToken, exp: accessExp } = signAccessToken(user);
    const { token: refreshToken, exp: refreshExp } = signRefreshToken(user);
    await persistRefreshToken({ user, token: refreshToken, exp: refreshExp, req });

    bus.emit("auth:login", { reqId: req.id, userId: user._id.toString() });
    logger.info("Login OK", { reqId: req.id, userId: user._id.toString() });

    res.json({
      user: { _id: user._id, email: user.email, nombre: user.nombre, rol: user.rol },
      accessToken,
      accessExp,
      refreshToken,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /auth/refresh
 * Rota el refresh token (revoca el viejo y crea uno nuevo) y devuelve un nuevo Access.
 * Entrada: refreshToken por body, header x-refresh-token o cookie.
 */
exports.auth_refresh = async (req, res, next) => {
  try {
    const token = getRefreshFromReq(req);
    if (!token) return res.status(400).json({ error: "Falta refreshToken", reqId: req.id });

    // 1) Verificar firma/expiración del refresh token
    const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    if (payload.type !== "refresh") throw new Error("Tipo de token inválido");

    // 2) Validar que exista en DB y que no esté revocado/expirado
    const found = await RefreshToken.findOne({ token, usuario: payload.sub });
    if (!found || found.revocadoEn || found.expiraEn <= new Date()) {
      logger.warn("Refresh inválido o revocado", { reqId: req.id });
      return res.status(401).json({ error: "Refresh inválido", reqId: req.id });
    }

    // 3) Rotación: revocar el actual y emitir uno nuevo
    found.revocadoEn = new Date();
    await found.save();

    const user = await Usuario.findById(payload.sub);
    if (!user) return res.status(401).json({ error: "Usuario no existe", reqId: req.id });

    const { token: newAccess, exp: accessExp } = signAccessToken(user);
    const { token: newRefresh, exp: refreshExp } = signRefreshToken(user);
    await persistRefreshToken({ user, token: newRefresh, exp: refreshExp, req });

    bus.emit("auth:refresh", { reqId: req.id, userId: user._id.toString() });
    logger.info("Refresh OK (rotado)", { reqId: req.id, userId: user._id.toString() });

    res.json({ accessToken: newAccess, accessExp, refreshToken: newRefresh });
  } catch (err) {
    logger.warn("Refresh error", { reqId: req.id, err: err?.message });
    return res.status(401).json({ error: "Refresh inválido o expirado", reqId: req.id });
  }
};

/**
 * POST /auth/logout
 * Revoca el refresh token recibido (termina la sesión de ese dispositivo).
 * Entrada: refreshToken por body, header x-refresh-token o cookie.
 */
exports.auth_logout = async (req, res, next) => {
  try {
    const token = getRefreshFromReq(req);
    if (!token) return res.status(400).json({ error: "Falta refreshToken", reqId: req.id });

    const found = await RefreshToken.findOne({ token });
    if (found && !found.revocadoEn) {
      found.revocadoEn = new Date();
      await found.save();
    }

    bus.emit("auth:logout", { reqId: req.id, refreshId: found?._id?.toString() });
    logger.info("Logout (refresh revocado)", { reqId: req.id, refreshId: found?._id?.toString() });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};
