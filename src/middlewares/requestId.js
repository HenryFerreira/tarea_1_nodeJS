const { v4: uuid } = require("uuid");

module.exports = function requestId(req, res, next) {
  req.id = uuid();
  res.setHeader("X-Request-Id", req.id);
  next();
};
