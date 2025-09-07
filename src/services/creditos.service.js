/**
 * Servicio de Créditos
 * ====================
 * Calcula créditos acumulados del usuario a partir del Historial.
 *
 * Regla base (habitual):
 *  - Se suman los créditos de las materias en estado **APROBADO**
 *
 * Parámetros opcionales:
 *  - estados: array de estados válidos (por defecto: ['APROBADO'])
 *  - hastaSemestre: limita materias con semestre <= hastaSemestre (opcional)
 *
 * Implementación:
 *  - Usamos agregación Mongo para hacer $lookup a 'materias' y sumar creditos.
 */

const { Types } = require("mongoose");
const Historial = require("../models/historial.model");

const ESTADOS_VALIDOS = new Set(["PENDIENTE","EN_CURSO","CURSADO","APROBADO"]);

async function calcularCreditos({ usuarioId, estados = ["APROBADO"], hastaSemestre }) {
  if (!Types.ObjectId.isValid(usuarioId)) {
    throw new Error("usuarioId inválido");
  }

  // Normalizamos estados (por si viene coma-separado del query)
  const listEstados = Array.isArray(estados)
    ? estados
    : String(estados).split(",").map(s => s.trim().toUpperCase()).filter(Boolean);

  const estadosFiltrados = listEstados.filter(e => ESTADOS_VALIDOS.has(e));
  if (estadosFiltrados.length === 0) {
    // si no hay estados válidos, por defecto usamos APROBADO
    estadosFiltrados.push("APROBADO");
  }

  const matchMateriaSem = (hastaSemestre != null)
    ? { "materia.semestre": { $lte: Number(hastaSemestre) } }
    : {};

  const pipeline = [
    { $match: { usuario: new Types.ObjectId(usuarioId), estado: { $in: estadosFiltrados } } },
    { $lookup: {
        from: "materias",
        localField: "materia",
        foreignField: "_id",
        as: "materia"
    }},
    { $unwind: "$materia" },
    ...(hastaSemestre != null ? [{ $match: matchMateriaSem }] : []),
    { $project: {
        materiaId: "$materia._id",
        codigo: "$materia.codigo",
        nombre: "$materia.nombre",
        semestre: "$materia.semestre",
        creditos: "$materia.creditos",
        estado: "$estado",
        fecha: "$fecha"
    }},
    { $group: {
        _id: null,
        totalCreditos: { $sum: "$creditos" },
        detalle: { $push: "$$ROOT" }
    }},
    { $project: { _id: 0, totalCreditos: 1, detalle: 1 } }
  ];

  const res = await Historial.aggregate(pipeline);
  if (!res || res.length === 0) {
    return { totalCreditos: 0, detalle: [] };
  }
  return res[0];
}

module.exports = { calcularCreditos };
