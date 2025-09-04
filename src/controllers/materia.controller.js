// src/controllers/materia.controller.js
const Materia = require("../models/materia.model");
const bus = require("../events/bus");

async function crearMateria(req, res, next) {
  try {
    const materia = await Materia.create(req.body);

    // Emitís el evento con datos útiles + reqId para correlación
    bus.emit("materia:creada", {
      reqId: req.id,
      materiaId: materia._id.toString(),
      userId: req.user?._id?.toString(), // cuando tengas auth
    });

    res.status(201).json(materia);
  } catch (err) {
    next(err);
  }
}

module.exports = { crearMateria };
