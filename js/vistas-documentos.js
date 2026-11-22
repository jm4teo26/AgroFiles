// =====================================================================
// vistas-documentos.js — Subir, ver, editar y borrar documentos
// ---------------------------------------------------------------------
// Un "documento" (ej. la INE de Juan) puede tener varios archivos
// (frente y vuelta, varias hojas...). Cada documento pertenece a:
//   personaId  (acta, CURP, INE, constancia, opinión, otros)
//   parcelaId  (certificado parcelario / carta notariada)
//   contratoId (contrato firmado)
// =====================================================================

import { TIPOS_DOCUMENTO } from './config.js';
import {
  guardar, obtener, nuevoId, guardarArchivo, leerArchivo, borrarArchivo, borrarDocumento,
} from './almacen.js';
import { estadoDocumento, ETIQUETA_ESTADO, documentoActual, nombrePersona, describirParcela, describirContrato } from './logica.js';
import { abrirModal, aviso, confirmar, conEspera, valoresFormulario } from './ui.js';
import { editarImagen } from './editor.js';
import { esPDF, esImagen, normalizarImagen, girarPDF, unirEnPDF } from './pdfs.js';
import { esc, leerBytes, tamano, abrirEnPestana, descargar, nombreArchivo, compartir } from './util.js';

let alCambiar = () => {};
/** app.js registra aquí la función para refrescar la pantalla después de un cambio. */
export function alCambiarDocumentos(fn) { alCambiar = fn; }

// ---------------------------------------------------------------------
// Renglón de documento (se usa en persona, parcela, contrato y portafolio)
// ---------------------------------------------------------------------
export function renglonDocumento({ etiqueta, campo, id, tipos, doc, extra = '', reemplazable = true }) {
  if (doc === undefined) doc = id ? documentoActual(campo, id, tipos) : null;
  const e = id ? estadoDocumento(doc) : { estado: 'falta', texto: 'Falta capturar la persona' };
  const nArch = doc?.archivos?.length || 0;
  const datos = `data-campo="${esc(campo)}" data-id="${esc(id || '')}" data-tipos="${esc(tipos.join(','))}"`;
  return `
    <div class="doc doc-${e.estado}">
      <span class="doc-icono" title="${esc(e.texto)}">${ETIQUETA_ESTADO[e.estado]}</span>
      <div class="doc-info">
        <strong>${esc(etiqueta)}</strong>
        <small>${esc(e.texto)}${nArch ? ` · ${nArch} archivo${nArch > 1 ? 's' : ''}` : ''}${extra}</small>
      </div>
      <div class="doc-botones">
        ${doc ? `<button type="button" class="btn btn-chico" data-doc="ver" data-doc-id="${esc(doc.id)}">Ver</button>` : ''}
        ${id && (reemplazable || !doc) ? `<button type="button" class="btn btn-chico ${doc ? '' : 'btn-primario'}" data-doc="subir" ${datos} ${doc ? `data-reemplaza="${esc(doc.id)}"` : ''}>${doc ? 'Reemplazar' : 'Subir'}</button>` : ''}
      </div>
    </div>`;
}

/** Maneja los clics en botones data-doc="..." de cualquier pantalla. */
export async function manejarClicDocumento(boton) {
  const accion = boton.dataset.doc;
  if (accion === 'ver') return verDocumento(boton.dataset.docId);
  if (accion === 'subir') {
    return subirDocumento({
      campo: boton.dataset.campo,
      id: boton.dataset.id,
      tipos: boton.dataset.tipos.split(','),
      reemplazaId: boton.dataset.reemplaza || null,
    });
  }
}

function nombreDueno(doc) {
  if (doc.personaId) return nombrePersona(doc.personaId);
  if (doc.parcelaId) return describirParcela(obtener('parcelas', doc.parcelaId));
  if (doc.contratoId) return describirContrato(obtener('contratos', doc.contratoId));
  return '';
}

function camposFecha(tipo, doc = {}) {
  const regla = TIPOS_DOCUMENTO[tipo]?.vence;
  if (regla === 'ine') {
    return `<label class="campo">Año de vigencia de la INE <small>(viene impreso, ej. "VIGENCIA 2022-2032" → 2032)</small>
      <input type="number" name="vigenciaAnio" min="2000" max="2100" inputmode="numeric" value="${esc(doc.vigenciaAnio || '')}"></label>`;
  }
  if (regla) {
    return `<label class="campo">Fecha de emisión <small>(la que aparece en el documento)</small>
      <input type="date" name="fechaEmision" value="${esc(doc.fechaEmision || '')}"></label>`;
  }
  return '';
}

// ---------------------------------------------------------------------
// SUBIR un documento nuevo (o reemplazar uno existente)
// ---------------------------------------------------------------------
export function subirDocumento({ campo, id, tipos, reemplazaId = null, tipoInicial = null }) {
  const opciones = tipos.map(t => `<option value="${t}" ${t === tipoInicial ? 'selected' : ''}>${esc(TIPOS_DOCUMENTO[t]?.nombre || t)}</option>`).join('');
  const m = abrirModal(reemplazaId ? 'Reemplazar documento' : 'Subir documento', `
    <form class="formulario">
      <p class="ayuda">Para: <strong>${esc(campo === 'personaId' ? nombrePersona(id)
        : campo === 'parcelaId' ? describirParcela(obtener('parcelas', id)) : describirContrato(obtener('contratos', id)))}</strong></p>
      <label class="campo" ${tipos.length === 1 ? 'hidden' : ''}>Tipo de documento
        <select name="tipo">${opciones}</select></label>
      <label class="campo" data-titulo hidden>Nombre del documento <input name="titulo" placeholder="Ej. Comprobante de domicilio"></label>
      <div data-fechas></div>
      <div class="campo">
        Archivos (PDF o fotos; puedes elegir varios)
        <div class="botones-fila">
          <label class="btn">📁 Elegir archivos<input type="file" accept="application/pdf,image/*" multiple data-archivos hidden></label>
          <label class="btn">📷 Tomar foto<input type="file" accept="image/*" capture="environment" data-archivos hidden></label>
        </div>
      </div>
      <ul class="lista-archivos" data-lista></ul>
      <label class="campo">Notas <input name="notas"></label>
      ${reemplazaId ? '<p class="ayuda">El documento anterior se borrará y quedará este en su lugar.</p>' : ''}
      <div class="acciones">
        <button type="button" class="btn" data-cancelar>Cancelar</button>
        <button type="submit" class="btn btn-primario">Guardar</button>
      </div>
    </form>`, { sinFoco: true });

  const form = m.cuerpo.querySelector('form');
  const pendientes = []; // { nombre, mime, bytes, url }
  const listaEl = form.querySelector('[data-lista]');

  const pintarFechas = () => {
    const t = form.tipo.value;
    form.querySelector('[data-fechas]').innerHTML = camposFecha(t);
    form.querySelector('[data-titulo]').hidden = t !== 'OTRO';
  };
  form.tipo.onchange = pintarFechas;
  pintarFechas();

  const pintarLista = () => {
    listaEl.innerHTML = pendientes.map((p, i) => `
      <li>
        ${esImagen(p.mime) ? `<img src="${p.url}" alt="">` : '<span class="icono-pdf">PDF</span>'}
        <span class="nombre">${esc(p.nombre)}<small>${tamano(p.bytes.length)}</small></span>
        ${esImagen(p.mime) ? `<button type="button" class="btn btn-chico" data-editar="${i}">Editar</button>` : ''}
        <button type="button" class="btn btn-chico" data-subir="${i}" ${i === 0 ? 'disabled' : ''}>↑</button>
        <button type="button" class="btn btn-chico btn-peligro" data-quitar="${i}">✕</button>
      </li>`).join('');
  };

  form.querySelectorAll('[data-archivos]').forEach(input => {
    input.onchange = async () => {
      for (const f of input.files) {
        const mime = f.type || (f.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
        if (!esPDF(mime) && !esImagen(mime)) { aviso(`"${f.name}" no es PDF ni imagen.`, 'error'); continue; }
        let bytes = await leerBytes(f);
        let tipoFinal = mime;
        if (esImagen(mime) && (!['image/jpeg', 'image/png'].includes(mime) || bytes.length > 2.5e6)) {
          try { bytes = await normalizarImagen(bytes, mime); tipoFinal = 'image/jpeg'; } catch (e) { aviso(e.message, 'error'); continue; }
        }
        pendientes.push({ nombre: f.name, mime: tipoFinal, bytes, url: esImagen(tipoFinal) ? URL.createObjectURL(new Blob([bytes], { type: tipoFinal })) : null });
      }
      input.value = '';
      pintarLista();
    };
  });

  listaEl.onclick = async (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.dataset.quitar) { pendientes.splice(+b.dataset.quitar, 1); pintarLista(); }
    if (b.dataset.subir) { const i = +b.dataset.subir; [pendientes[i - 1], pendientes[i]] = [pendientes[i], pendientes[i - 1]]; pintarLista(); }
    if (b.dataset.editar) {
      const p = pendientes[+b.dataset.editar];
      const nuevo = await editarImagen(p.bytes, p.mime);
      if (nuevo) {
        p.bytes = nuevo; p.mime = 'image/jpeg';
        if (p.url) URL.revokeObjectURL(p.url);
        p.url = URL.createObjectURL(new Blob([nuevo], { type: 'image/jpeg' }));
        pintarLista();
      }
    }
  };

  form.querySelector('[data-cancelar]').onclick = () => m.cerrar();
  form.onsubmit = async (ev) => {
    ev.preventDefault();
    if (!pendientes.length) { aviso('Agrega al menos un archivo.', 'error'); return; }
    const v = valoresFormulario(form);
    await conEspera('Guardando y cifrando…', async () => {
      const doc = {
        tipo: v.tipo, titulo: v.titulo || '', notas: v.notas || '',
        fechaEmision: v.fechaEmision || '', vigenciaAnio: v.vigenciaAnio || '',
        [campo]: id, archivos: [],
      };
      for (const p of pendientes) {
        const archivoId = nuevoId();
        await guardarArchivo(archivoId, p.bytes);
        doc.archivos.push({ id: archivoId, nombre: p.nombre, mime: p.mime, tam: p.bytes.length });
      }
      await guardar('documentos', doc);
      if (reemplazaId) await borrarDocumento(reemplazaId);
    });
    pendientes.forEach(p => p.url && URL.revokeObjectURL(p.url));
    m.cerrar();
    aviso('Documento guardado.');
    alCambiar();
  };
}

// ---------------------------------------------------------------------
// VER un documento: sus archivos, fechas y acciones
// ---------------------------------------------------------------------
export async function verDocumento(docId) {
  const doc = obtener('documentos', docId);
  if (!doc) return;
  const e = estadoDocumento(doc);
  const urls = [];
  const m = abrirModal(doc.titulo || TIPOS_DOCUMENTO[doc.tipo]?.nombre || 'Documento', `
    <p class="ayuda">${esc(nombreDueno(doc))}</p>
    <p class="estado-linea doc-${e.estado}">${ETIQUETA_ESTADO[e.estado]} ${esc(e.texto)}</p>
    <form class="formulario" data-fechas-form>
      ${camposFecha(doc.tipo, doc)}
      <label class="campo">Notas <input name="notas" value="${esc(doc.notas || '')}"></label>
      <button type="submit" class="btn btn-chico">Guardar datos</button>
    </form>
    <h3>Archivos</h3>
    <ul class="lista-archivos" data-lista><li>Cargando…</li></ul>
    <div class="botones-fila">
      <label class="btn">📁 Agregar archivos<input type="file" accept="application/pdf,image/*" multiple data-agregar hidden></label>
      <label class="btn">📷 Tomar foto<input type="file" accept="image/*" capture="environment" data-agregar hidden></label>
    </div>
    <div class="acciones">
      <button type="button" class="btn btn-peligro" data-borrar-doc>Borrar documento</button>
      <button type="button" class="btn" data-compartir>Compartir</button>
      <button type="button" class="btn btn-primario" data-pdf>Descargar como PDF</button>
    </div>`, { ancho: 'grande', sinFoco: true, alCerrar: () => urls.forEach(u => URL.revokeObjectURL(u)) });

  const listaEl = m.cuerpo.querySelector('[data-lista]');

  async function pintar() {
    const partes = [];
    for (const [i, a] of doc.archivos.entries()) {
      let miniatura = '<span class="icono-pdf">PDF</span>';
      if (esImagen(a.mime)) {
        const bytes = await leerArchivo(a.id);
        const url = URL.createObjectURL(new Blob([bytes], { type: a.mime }));
        urls.push(url);
        miniatura = `<img src="${url}" alt="">`;
      }
      partes.push(`<li>
        ${miniatura}
        <span class="nombre">${esc(a.nombre)}<small>${tamano(a.tam || 0)}</small></span>
        <button type="button" class="btn btn-chico" data-a="abrir" data-i="${i}">Abrir</button>
        ${esImagen(a.mime) ? `<button type="button" class="btn btn-chico" data-a="editar" data-i="${i}">Editar</button>`
          : `<button type="button" class="btn btn-chico" data-a="girar" data-i="${i}" title="Girar todas las hojas">↻</button>`}
        <button type="button" class="btn btn-chico" data-a="subir" data-i="${i}" ${i === 0 ? 'disabled' : ''}>↑</button>
        <button type="button" class="btn btn-chico btn-peligro" data-a="borrar" data-i="${i}">✕</button>
      </li>`);
    }
    listaEl.innerHTML = partes.join('') || '<li>Sin archivos.</li>';
  }

  const guardarDoc = async () => { await guardar('documentos', doc); alCambiar(); };

  listaEl.onclick = async (ev) => {
    const b = ev.target.closest('[data-a]');
    if (!b) return;
    const i = +b.dataset.i;
    const a = doc.archivos[i];
    if (b.dataset.a === 'abrir') {
      const bytes = await leerArchivo(a.id);
      abrirEnPestana(new Blob([bytes], { type: a.mime }));
    } else if (b.dataset.a === 'editar') {
      const nuevo = await editarImagen(await leerArchivo(a.id), a.mime);
      if (!nuevo) return;
      await conEspera('Guardando…', async () => {
        await guardarArchivo(a.id, nuevo);
        a.mime = 'image/jpeg'; a.tam = nuevo.length;
        await guardarDoc();
      });
      await pintar();
    } else if (b.dataset.a === 'girar') {
      await conEspera('Girando…', async () => {
        const nuevo = await girarPDF(await leerArchivo(a.id), 90);
        await guardarArchivo(a.id, nuevo);
        a.tam = nuevo.length;
        await guardarDoc();
      });
      aviso('PDF girado 90°.');
    } else if (b.dataset.a === 'subir' && i > 0) {
      [doc.archivos[i - 1], doc.archivos[i]] = [doc.archivos[i], doc.archivos[i - 1]];
      await guardarDoc(); await pintar();
    } else if (b.dataset.a === 'borrar') {
      if (!await confirmar(`¿Borrar el archivo "${a.nombre}"?`, { si: 'Borrar', peligro: true })) return;
      await borrarArchivo(a.id);
      doc.archivos.splice(i, 1);
      await guardarDoc(); await pintar();
    }
  };

  m.cuerpo.querySelectorAll('[data-agregar]').forEach(input => {
    input.onchange = async () => {
      await conEspera('Guardando y cifrando…', async () => {
        for (const f of input.files) {
          const mime = f.type || 'application/pdf';
          if (!esPDF(mime) && !esImagen(mime)) continue;
          let bytes = await leerBytes(f), tipo = mime;
          if (esImagen(mime) && (!['image/jpeg', 'image/png'].includes(mime) || bytes.length > 2.5e6)) {
            bytes = await normalizarImagen(bytes, mime); tipo = 'image/jpeg';
          }
          const archivoId = nuevoId();
          await guardarArchivo(archivoId, bytes);
          doc.archivos.push({ id: archivoId, nombre: f.name, mime: tipo, tam: bytes.length });
        }
        await guardarDoc();
      });
      input.value = '';
      await pintar();
    };
  });

  m.cuerpo.querySelector('[data-fechas-form]').onsubmit = async (ev) => {
    ev.preventDefault();
    const v = valoresFormulario(ev.target);
    Object.assign(doc, v);
    await guardarDoc();
    aviso('Datos guardados.');
    m.cerrar();
  };

  m.cuerpo.querySelector('[data-borrar-doc]').onclick = async () => {
    if (!await confirmar('¿Borrar este documento y todos sus archivos?', { si: 'Borrar', peligro: true })) return;
    await borrarDocumento(doc.id);
    m.cerrar();
    aviso('Documento borrado.');
    alCambiar();
  };

  const comoPDF = async () => {
    const archivos = [];
    for (const a of doc.archivos) archivos.push({ bytes: await leerArchivo(a.id), mime: a.mime, titulo: a.nombre });
    const r = await unirEnPDF(archivos, { titulo: doc.titulo || TIPOS_DOCUMENTO[doc.tipo]?.nombre });
    const nombre = `${nombreArchivo(TIPOS_DOCUMENTO[doc.tipo]?.nombre || 'DOC')}_${nombreArchivo(nombreDueno(doc))}.pdf`;
    return { blob: new Blob([r.bytes], { type: 'application/pdf' }), nombre };
  };
  m.cuerpo.querySelector('[data-pdf]').onclick = async () => {
    const { blob, nombre } = await conEspera('Armando PDF…', comoPDF);
    descargar(blob, nombre);
  };
  m.cuerpo.querySelector('[data-compartir]').onclick = async () => {
    const { blob, nombre } = await conEspera('Armando PDF…', comoPDF);
    if (!await compartir(blob, nombre)) descargar(blob, nombre);
  };

  await pintar();
}

/** Lista de documentos "OTRO" de una persona. */
export function documentosExtra(docs) {
  return docs.map(d => renglonDocumento({
    etiqueta: d.titulo || 'Otro documento', campo: 'personaId', id: d.personaId, tipos: ['OTRO'], doc: d, reemplazable: false,
  })).join('');
}
