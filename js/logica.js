// =====================================================================
// logica.js — Reglas del negocio: vencimientos, qué le falta a un
// portafolio, en qué orden van los documentos y la búsqueda.
// =====================================================================

import { TIPOS_DOCUMENTO, DIAS_AVISO } from './config.js';
import { lista, obtener } from './almacen.js';
import { hoyISO, sumarMeses, sumarDias, diasEntre, fechaCorta, normalizar } from './util.js';

// ---------------------------------------------------------------------
// VENCIMIENTOS
// ---------------------------------------------------------------------

/** Fecha en que vence un documento (o null si no vence / falta el dato). */
export function fechaVencimiento(doc) {
  const regla = TIPOS_DOCUMENTO[doc.tipo]?.vence;
  if (!regla) return null;
  if (regla === 'ine') return doc.vigenciaAnio ? `${doc.vigenciaAnio}-12-31` : null;
  if (!doc.fechaEmision) return null;
  if (regla.meses) return sumarMeses(doc.fechaEmision, regla.meses);
  if (regla.dias) return sumarDias(doc.fechaEmision, regla.dias);
  return null;
}

/**
 * Estado de un documento:
 *   'falta'      → no existe
 *   'sin-dato'   → existe pero le falta la fecha para saber si está vigente
 *   'vencido'    → ya venció
 *   'por-vencer' → vence dentro de los próximos DIAS_AVISO días
 *   'ok'         → vigente o no vence
 */
export function estadoDocumento(doc) {
  if (!doc || !(doc.archivos || []).length) {
    return { estado: 'falta', texto: doc ? 'Sin archivos' : 'Falta' };
  }
  const regla = TIPOS_DOCUMENTO[doc.tipo]?.vence;
  if (!regla) return { estado: 'ok', texto: 'Listo' };
  const vence = fechaVencimiento(doc);
  if (!vence) {
    return { estado: 'sin-dato', texto: regla === 'ine' ? 'Falta año de vigencia' : 'Falta fecha de emisión' };
  }
  const dias = diasEntre(hoyISO(), vence);
  if (dias < 0) return { estado: 'vencido', texto: `Vencido desde ${fechaCorta(vence)}`, vence };
  if (dias <= DIAS_AVISO) return { estado: 'por-vencer', texto: `Vence en ${dias} día${dias === 1 ? '' : 's'} (${fechaCorta(vence)})`, vence };
  return { estado: 'ok', texto: `Vigente hasta ${fechaCorta(vence)}`, vence };
}

export const ETIQUETA_ESTADO = {
  ok: '✔', falta: '✖', 'sin-dato': '?', vencido: '⚠', 'por-vencer': '⏳',
};

// ---------------------------------------------------------------------
// CONSULTAS
// ---------------------------------------------------------------------

export const ordenarPorNombre = (a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es');

export function personasOrdenadas() {
  return lista('personas').sort(ordenarPorNombre);
}

/** Documentos de un dueño (persona, parcela o contrato). */
export function documentosDe(campo, id) {
  return lista('documentos').filter(d => d[campo] === id);
}

/** El documento más reciente de un tipo para un dueño. */
export function documentoActual(campo, id, tipos) {
  const arr = Array.isArray(tipos) ? tipos : [tipos];
  const docs = documentosDe(campo, id).filter(d => arr.includes(d.tipo));
  docs.sort((a, b) => (b.fechaEmision || b.creado || '').localeCompare(a.fechaEmision || a.creado || ''));
  return docs[0] || null;
}

export function nombrePersona(id) {
  return obtener('personas', id)?.nombre || '(sin persona)';
}

export function describirParcela(p) {
  if (!p) return '(parcela borrada)';
  const partes = [];
  if (p.numero) partes.push(`Parcela ${p.numero}`);
  partes.push(`${p.superficie || '?'} ha`);
  if (p.ejido) partes.push(`Ejido ${p.ejido}`);
  return partes.join(' · ');
}

export function describirContrato(c) {
  if (!c) return '(contrato borrado)';
  return `${nombrePersona(c.parceleroId)} → ${nombrePersona(c.inversionistaId)} · ${c.ciclo || ''}`;
}

/** Todos los documentos con aviso (vencidos, por vencer o sin fecha). */
export function avisosDocumentos() {
  const salida = [];
  for (const d of lista('documentos')) {
    if (!TIPOS_DOCUMENTO[d.tipo]?.vence) continue;
    // Solo cuenta el documento más reciente de cada tipo por persona.
    const actual = documentoActual('personaId', d.personaId, d.tipo);
    if (actual && actual.id !== d.id) continue;
    const e = estadoDocumento(d);
    if (e.estado === 'ok') continue;
    salida.push({ doc: d, ...e });
  }
  const peso = { vencido: 0, 'por-vencer': 1, 'sin-dato': 2, falta: 3 };
  return salida.sort((a, b) => peso[a.estado] - peso[b.estado]);
}

// ---------------------------------------------------------------------
// PORTAFOLIO: lista de lo que debe llevar y su estado
// ---------------------------------------------------------------------

/**
 * Devuelve la lista de renglones del portafolio. Cada renglón:
 * { clave, seccion, etiqueta, tipos[], dueno: {campo, id}, doc, estado, texto }
 */
export function renglonesPortafolio(port) {
  const filas = [];
  const agregar = (clave, seccion, etiqueta, tipos, campo, id) => {
    const doc = id ? documentoActual(campo, id, tipos) : null;
    const e = id ? estadoDocumento(doc) : { estado: 'falta', texto: 'Falta capturar la persona/contrato' };
    filas.push({ clave, seccion, etiqueta, tipos, dueno: { campo, id }, doc, ...e });
  };

  const agricultor = obtener('personas', port.agricultorId);
  const secAgr = `Agricultor: ${agricultor?.nombre || '(sin agricultor)'}`;
  for (const tipo of port.requeridos || []) {
    agregar(`p:${tipo}`, secAgr, TIPOS_DOCUMENTO[tipo]?.nombre || tipo, [tipo], 'personaId', port.agricultorId);
  }

  (port.parcelas || []).forEach((pp, i) => {
    const parcela = obtener('parcelas', pp.parcelaId);
    const sec = `Parcela ${i + 1} (${pp.modo === 'rentada' ? 'rentada' : 'propia'}): ${describirParcela(parcela)}`;
    const k = `${pp.parcelaId}`;
    if (pp.modo === 'rentada') {
      const c = obtener('contratos', pp.contratoId);
      agregar(`${k}:contrato`, sec, 'Contrato de arrendamiento firmado', ['CONTRATO_FIRMADO'], 'contratoId', c?.id);
      agregar(`${k}:ine-parcelero`, sec, `INE parcelero: ${c ? nombrePersona(c.parceleroId) : '—'}`, ['INE'], 'personaId', c?.parceleroId);
      agregar(`${k}:ine-inversionista`, sec, `INE inversionista: ${c ? nombrePersona(c.inversionistaId) : '—'}`, ['INE'], 'personaId', c?.inversionistaId);
      agregar(`${k}:ine-testigo1`, sec, `INE testigo: ${c ? nombrePersona(c.testigo1Id) : '—'}`, ['INE'], 'personaId', c?.testigo1Id);
      agregar(`${k}:ine-testigo2`, sec, `INE testigo: ${c ? nombrePersona(c.testigo2Id) : '—'}`, ['INE'], 'personaId', c?.testigo2Id);
      agregar(`${k}:propiedad`, sec, `Certificado parcelario / documento de propiedad del dueño`, ['CERTIFICADO', 'CARTA'], 'parcelaId', parcela?.id);
    } else {
      agregar(`${k}:propiedad`, sec, 'Certificado parcelario / documento de propiedad', ['CERTIFICADO', 'CARTA'], 'parcelaId', parcela?.id);
    }
  });
  return filas;
}

/** Aplica el orden guardado por el usuario (los renglones nuevos van al final). */
export function ordenarRenglones(port, filas) {
  const orden = port.orden || [];
  const pos = new Map(orden.map((c, i) => [c, i]));
  return filas
    .map((f, i) => ({ f, i }))
    .sort((a, b) => {
      const pa = pos.has(a.f.clave) ? pos.get(a.f.clave) : 1e6 + a.i;
      const pb = pos.has(b.f.clave) ? pos.get(b.f.clave) : 1e6 + b.i;
      return pa - pb;
    })
    .map(x => x.f);
}

export function resumenPortafolio(port) {
  const filas = renglonesPortafolio(port);
  const listos = filas.filter(f => f.estado === 'ok').length;
  const problemas = filas.filter(f => f.estado !== 'ok').length;
  return { total: filas.length, listos, problemas };
}

// ---------------------------------------------------------------------
// BÚSQUEDA (en todo)
// ---------------------------------------------------------------------
export function buscarTodo(consulta) {
  const palabras = normalizar(consulta).split(/\s+/).filter(Boolean);
  if (!palabras.length) return [];
  const coincide = (...campos) => {
    const texto = normalizar(campos.filter(Boolean).join(' '));
    return palabras.every(p => texto.includes(p));
  };
  const r = [];
  for (const p of lista('personas')) {
    if (coincide(p.nombre, p.curp, p.rfc, p.telefono, p.domicilio, p.notas)) {
      r.push({ tipo: 'Persona', titulo: p.nombre, detalle: [p.curp, p.rfc].filter(Boolean).join(' · '), ruta: `#/persona/${p.id}` });
    }
  }
  for (const p of lista('parcelas')) {
    const dueno = nombrePersona(p.propietarioId);
    const col = p.colindancias || {};
    if (coincide(p.numero, p.certificado, p.ejido, p.municipio, p.superficie, dueno, col.norte, col.sur, col.este, col.oeste, p.notas)) {
      r.push({ tipo: 'Parcela', titulo: describirParcela(p), detalle: `Dueño: ${dueno}`, ruta: `#/parcela/${p.id}` });
    }
  }
  for (const c of lista('contratos')) {
    if (coincide(nombrePersona(c.parceleroId), nombrePersona(c.inversionistaId), nombrePersona(c.testigo1Id),
      nombrePersona(c.testigo2Id), c.ciclo, c.cultivo, c.ejido, String(c.monto))) {
      r.push({ tipo: 'Contrato', titulo: describirContrato(c), detalle: `${c.hectareas || ''} ha · Ejido ${c.ejido || ''}`, ruta: `#/contrato/${c.id}` });
    }
  }
  for (const p of lista('portafolios')) {
    if (coincide(nombrePersona(p.agricultorId), p.ciclo, p.titulo, p.notas)) {
      r.push({ tipo: 'Portafolio', titulo: `${nombrePersona(p.agricultorId)} · ${p.ciclo}`, detalle: p.titulo || '', ruta: `#/portafolio/${p.id}` });
    }
  }
  for (const d of lista('documentos')) {
    const tipoNombre = TIPOS_DOCUMENTO[d.tipo]?.nombre || d.tipo;
    const nombres = (d.archivos || []).map(a => a.nombre).join(' ');
    let dueno = '', ruta = '';
    if (d.personaId) { dueno = nombrePersona(d.personaId); ruta = `#/persona/${d.personaId}`; }
    else if (d.parcelaId) { dueno = describirParcela(obtener('parcelas', d.parcelaId)); ruta = `#/parcela/${d.parcelaId}`; }
    else if (d.contratoId) { dueno = describirContrato(obtener('contratos', d.contratoId)); ruta = `#/contrato/${d.contratoId}`; }
    if (coincide(tipoNombre, d.titulo, nombres, dueno, d.notas)) {
      r.push({ tipo: 'Documento', titulo: `${d.titulo || tipoNombre}`, detalle: dueno, ruta });
    }
  }
  return r;
}
