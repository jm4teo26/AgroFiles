// =====================================================================
// vistas-portafolios.js — Portafolios (expedientes) por ciclo agrícola
// ---------------------------------------------------------------------
// Un portafolio = un agricultor + un ciclo + sus parcelas (propias o
// rentadas). Los documentos NO se vuelven a subir: se toman de la
// persona, la parcela y el contrato. Aquí se ve qué falta o qué está
// vencido, se acomoda el orden y se descarga todo en un solo PDF.
// =====================================================================

import { TIPOS_DOCUMENTO, REQUERIDOS_POR_DEFECTO } from './config.js';
import { guardar, obtener, lista, borrar, leerArchivo } from './almacen.js';
import {
  renglonesPortafolio, ordenarRenglones, resumenPortafolio, nombrePersona, describirParcela,
  describirContrato, ETIQUETA_ESTADO,
} from './logica.js';
import { selectorPersona, enlazarSelectoresPersona } from './vistas-personas.js';
import { renglonDocumento } from './vistas-documentos.js';
import { unirEnPDF } from './pdfs.js';
import { abrirModal, aviso, confirmar, conEspera, valoresFormulario } from './ui.js';
import { esc, mayus, normalizar, nombreArchivo, descargar, abrirEnPestana, compartir } from './util.js';

const TIPOS_ELEGIBLES = ['ACTA', 'CURP', 'INE', 'CSF', 'OPINION'];

export function vistaPortafolios(cont) {
  const ciclos = [...new Set(lista('portafolios').map(p => p.ciclo))].sort().reverse();
  cont.innerHTML = `
    <div class="cabeza-vista">
      <h1>Portafolios</h1>
      <a class="btn btn-primario" href="#/portafolio/nuevo">➕ Nuevo portafolio</a>
    </div>
    <div class="fila">
      <input type="search" class="filtro" placeholder="Filtrar por agricultor o nombre…" data-filtro>
      <select class="filtro" data-ciclo><option value="">Todos los ciclos</option>
        ${ciclos.map(c => `<option>${esc(c)}</option>`).join('')}</select>
    </div>
    <div class="tarjetas" data-lista></div>`;
  const pintar = () => {
    const q = normalizar(cont.querySelector('[data-filtro]').value);
    const ciclo = cont.querySelector('[data-ciclo]').value;
    const ports = lista('portafolios')
      .filter(p => (!ciclo || p.ciclo === ciclo) && (!q || normalizar(`${nombrePersona(p.agricultorId)} ${p.titulo} ${p.ciclo}`).includes(q)))
      .sort((a, b) => nombrePersona(a.agricultorId).localeCompare(nombrePersona(b.agricultorId), 'es'));
    cont.querySelector('[data-lista]').innerHTML = ports.map(p => {
      const r = resumenPortafolio(p);
      const completo = r.total > 0 && r.listos === r.total;
      return `<a class="tarjeta" href="#/portafolio/${esc(p.id)}">
        <strong>${esc(nombrePersona(p.agricultorId))}</strong>
        <small>${esc(p.ciclo)}${p.titulo ? ' · ' + esc(p.titulo) : ''}</small>
        <div class="barra"><div style="width:${r.total ? Math.round(r.listos / r.total * 100) : 0}%"></div></div>
        <span class="pastilla ${completo ? 'pastilla-ok' : 'pastilla-mal'}">${r.listos} de ${r.total} listos</span>
      </a>`;
    }).join('') || '<p class="vacio">No hay portafolios.</p>';
  };
  cont.querySelector('[data-filtro]').oninput = pintar;
  cont.querySelector('[data-ciclo]').onchange = pintar;
  pintar();
}

/** Formulario de portafolio (nuevo o editar datos generales). */
export function vistaPortafolioFormulario(cont, id, params) {
  const p = id ? obtener('portafolios', id) : {
    agricultorId: params.get('agricultor') || '', requeridos: [...REQUERIDOS_POR_DEFECTO], parcelas: [],
  };
  if (!p) { cont.innerHTML = '<p class="vacio">Este portafolio ya no existe.</p>'; return; }
  const ciclosUsados = [...new Set([...lista('portafolios').map(x => x.ciclo), ...lista('contratos').map(x => x.ciclo)])].filter(Boolean);
  cont.innerHTML = `
    <div class="cabeza-vista"><div><a href="${id ? `#/portafolio/${esc(id)}` : '#/portafolios'}" class="volver">‹ Regresar</a>
      <h1>${id ? 'Editar portafolio' : 'Nuevo portafolio'}</h1></div></div>
    <form class="formulario panel">
      <label class="campo">Agricultor ${selectorPersona('agricultorId', p.agricultorId)}</label>
      <div class="fila">
        <label class="campo">Ciclo agrícola <input name="ciclo" required list="ciclos" value="${esc(p.ciclo || '')}" placeholder="O-I 2026 - 2027"></label>
        <label class="campo">Para qué es <small>(opcional)</small> <input name="titulo" value="${esc(p.titulo || '')}" placeholder="Crédito bodega"></label>
      </div>
      <datalist id="ciclos">${ciclosUsados.map(c => `<option value="${esc(c)}">`).join('')}</datalist>
      <fieldset>
        <legend>¿Qué documentos del agricultor requiere?</legend>
        ${TIPOS_ELEGIBLES.map(t => `<label class="casilla"><input type="checkbox" name="requeridos" value="${t}" ${(p.requeridos || []).includes(t) ? 'checked' : ''}> ${esc(TIPOS_DOCUMENTO[t].nombre)}</label>`).join('')}
      </fieldset>
      ${id ? '' : `<fieldset>
        <legend>Parcelas que siembra este ciclo</legend>
        <p class="ayuda">Se proponen sus parcelas propias y los contratos donde es inversionista. Después puedes agregar o quitar.</p>
        <div data-sugeridas><p class="vacio">Elige primero al agricultor.</p></div>
      </fieldset>`}
      <label class="campo">Notas <textarea name="notas" rows="2">${esc(p.notas || '')}</textarea></label>
      <div class="acciones"><button type="submit" class="btn btn-primario">${id ? 'Guardar' : 'Crear portafolio'}</button></div>
    </form>`;
  const form = cont.querySelector('form');
  enlazarSelectoresPersona(form);

  const sugerir = () => {
    const caja = form.querySelector('[data-sugeridas]');
    if (!caja) return;
    const ag = form.agricultorId.value;
    if (!ag || ag === '__nueva') { caja.innerHTML = '<p class="vacio">Elige primero al agricultor.</p>'; return; }
    const propias = lista('parcelas').filter(x => x.propietarioId === ag);
    const rentadas = lista('contratos').filter(c => c.inversionistaId === ag)
      .sort((a, b) => (b.fechaFirma || '').localeCompare(a.fechaFirma || ''));
    caja.innerHTML = [
      ...propias.map(x => `<label class="casilla"><input type="checkbox" name="sugeridas" value="propia|${esc(x.id)}|" checked> Propia: ${esc(describirParcela(x))}</label>`),
      ...rentadas.map(c => `<label class="casilla"><input type="checkbox" name="sugeridas" value="rentada|${esc(c.parcelaId || '')}|${esc(c.id)}" ${c.parcelaId ? 'checked' : 'disabled'}> Rentada: ${esc(describirContrato(c))}${c.parcelaId ? '' : ' (el contrato no tiene parcela ligada)'}</label>`),
    ].join('') || '<p class="vacio">Este agricultor no tiene parcelas ni contratos registrados todavía. Los puedes agregar después.</p>';
  };
  form.agricultorId.addEventListener('persona-elegida', sugerir);
  sugerir();

  form.onsubmit = async (ev) => {
    ev.preventDefault();
    const v = valoresFormulario(form);
    if (!v.agricultorId || v.agricultorId === '__nueva') { aviso('Elige al agricultor.', 'error'); return; }
    const reg = { ...p, agricultorId: v.agricultorId, ciclo: mayus(v.ciclo), titulo: v.titulo, notas: v.notas, requeridos: v.requeridos || [] };
    if (!id) {
      const sug = Array.isArray(v.sugeridas) ? v.sugeridas : (v.sugeridas ? [v.sugeridas] : []);
      reg.parcelas = sug.map(s => { const [modo, parcelaId, contratoId] = s.split('|'); return { modo, parcelaId, contratoId }; });
    }
    const g = await guardar('portafolios', reg);
    aviso('Portafolio guardado.');
    location.hash = `#/portafolio/${g.id}`;
  };
}

/** Ruta auxiliar: liga un contrato o parcela recién creada al portafolio y regresa. */
export async function vistaPortafolioLigar(cont, id, params) {
  const p = obtener('portafolios', id);
  if (!p) { location.hash = '#/portafolios'; return; }
  const contratoId = params.get('contrato');
  const parcelaNueva = params.get('parcela');
  if (contratoId) {
    const c = obtener('contratos', contratoId);
    const i = Number(params.get('fila'));
    if (Number.isInteger(i) && p.parcelas[i]) p.parcelas[i].contratoId = contratoId;
    else p.parcelas.push({ modo: 'rentada', parcelaId: c?.parcelaId || '', contratoId });
  } else if (parcelaNueva) {
    const parcela = obtener('parcelas', parcelaNueva);
    p.parcelas.push({ modo: parcela?.propietarioId === p.agricultorId ? 'propia' : 'rentada', parcelaId: parcelaNueva, contratoId: '' });
  }
  await guardar('portafolios', p);
  location.replace(`#/portafolio/${id}`);
}

export function vistaPortafolio(cont, id) {
  const p = obtener('portafolios', id);
  if (!p) { cont.innerHTML = '<p class="vacio">Este portafolio ya no existe.</p>'; return; }
  const filas = renglonesPortafolio(p);
  const listos = filas.filter(f => f.estado === 'ok').length;
  const vencidos = filas.filter(f => f.estado === 'vencido' || f.estado === 'por-vencer').length;
  const ordenadas = ordenarRenglones(p, filas);
  const excluidos = new Set(p.excluidos || []);

  // Agrupar por sección para la lista de revisión.
  const secciones = new Map();
  for (const f of filas) {
    if (!secciones.has(f.seccion)) secciones.set(f.seccion, []);
    secciones.get(f.seccion).push(f);
  }
  const volverAqui = encodeURIComponent(`#/portafolio/${id}/ligar?contrato={id}`);

  cont.innerHTML = `
    <div class="cabeza-vista">
      <div><a href="#/portafolios" class="volver">‹ Portafolios</a>
        <h1>${esc(nombrePersona(p.agricultorId))}</h1>
        <p class="subtitulo">${esc(p.ciclo)}${p.titulo ? ' · ' + esc(p.titulo) : ''}</p></div>
      <div class="botones-fila">
        <a class="btn" href="#/portafolio/${esc(id)}/editar">Editar</a>
        <button class="btn btn-peligro" data-borrar>Borrar</button>
      </div>
    </div>

    <section class="panel resaltado">
      <div class="barra grande"><div style="width:${filas.length ? Math.round(listos / filas.length * 100) : 0}%"></div></div>
      <p><strong>${listos} de ${filas.length}</strong> documentos listos${vencidos ? ` · <span class="txt-mal">${vencidos} vencido(s) o por vencer</span>` : ''}.</p>
    </section>

    ${[...secciones.entries()].map(([sec, fs]) => `
      <section class="panel">
        <h2>${esc(sec)}</h2>
        ${fs.map(f => {
          if (f.dueno.id) return renglonDocumento({ etiqueta: f.etiqueta, campo: f.dueno.campo, id: f.dueno.id, tipos: f.tipos, doc: f.doc });
          // Falta el contrato de una parcela rentada.
          const i = p.parcelas.findIndex(pp => f.clave.startsWith(pp.parcelaId + ':'));
          const pp = p.parcelas[i];
          return `<div class="doc doc-falta"><span class="doc-icono">${ETIQUETA_ESTADO.falta}</span>
            <div class="doc-info"><strong>${esc(f.etiqueta)}</strong><small>Falta elegir o hacer el contrato</small></div>
            ${f.clave.endsWith(':contrato') ? `<div class="doc-botones">
              <button class="btn btn-chico" data-elegir-contrato="${i}">Elegir contrato</button>
              <a class="btn btn-chico btn-primario" href="#/contrato/nuevo?parcela=${esc(pp?.parcelaId || '')}&inversionista=${esc(p.agricultorId)}&volver=${encodeURIComponent(`#/portafolio/${id}/ligar?fila=${i}&contrato={id}`)}">Hacer contrato</a>
            </div>` : ''}</div>`;
        }).join('')}
      </section>`).join('')}

    <section class="panel">
      <h2>Parcelas del portafolio</h2>
      ${(p.parcelas || []).map((pp, i) => `
        <div class="renglon">
          <span class="pastilla">${pp.modo === 'rentada' ? 'Rentada' : 'Propia'}</span>
          <span class="crece">${esc(describirParcela(obtener('parcelas', pp.parcelaId)))}${pp.contratoId ? ` · <a href="#/contrato/${esc(pp.contratoId)}">ver contrato</a>` : ''}</span>
          <button class="btn btn-chico btn-peligro" data-quitar-parcela="${i}">Quitar</button>
        </div>`).join('') || '<p class="vacio">Sin parcelas.</p>'}
      <div class="botones-fila">
        <button class="btn" data-agregar="propia">➕ Parcela propia</button>
        <button class="btn" data-agregar="rentada">➕ Parcela rentada (contrato existente)</button>
        <a class="btn" href="#/contrato/nuevo?inversionista=${esc(p.agricultorId)}&volver=${volverAqui}">➕ Hacer contrato nuevo</a>
      </div>
    </section>

    <section class="panel">
      <h2>Armar el PDF</h2>
      <p class="ayuda">Acomoda el orden con las flechas y quita la palomita a lo que no quieras incluir. El orden se guarda.</p>
      <ol class="orden" data-orden>
        ${ordenadas.map((f, i) => `
          <li class="${f.doc ? '' : 'sin-doc'}" data-clave="${esc(f.clave)}">
            <input type="checkbox" data-incluir ${!excluidos.has(f.clave) && f.doc ? 'checked' : ''} ${f.doc ? '' : 'disabled'} aria-label="Incluir">
            <span class="crece"><strong>${esc(f.etiqueta)}</strong><small>${esc(f.seccion)}${f.doc ? '' : ' · falta'}</small></span>
            <button class="btn btn-chico" data-mover="-1" ${i === 0 ? 'disabled' : ''} aria-label="Subir">↑</button>
            <button class="btn btn-chico" data-mover="1" ${i === ordenadas.length - 1 ? 'disabled' : ''} aria-label="Bajar">↓</button>
          </li>`).join('')}
      </ol>
      <div class="botones-fila">
        <button class="btn" data-restablecer>Restablecer orden</button>
      </div>
      <div class="botones-fila">
        <button class="btn btn-primario" data-armar="ver">🖨️ Ver / Imprimir</button>
        <button class="btn" data-armar="normal">⬇️ PDF en orden</button>
        <button class="btn" data-armar="inverso">⬇️ PDF inverso (para impresora)</button>
        <button class="btn" data-armar="compartir">📤 Compartir</button>
      </div>
      <p class="ayuda">El PDF inverso trae las hojas de la última a la primera: al imprimir, la pila sale ya acomodada.</p>
    </section>`;

  const recargar = () => vistaPortafolio(cont, id);

  // ---- Orden y exclusiones ----
  const guardarOrden = async () => {
    const lis = [...cont.querySelectorAll('[data-orden] li')];
    p.orden = lis.map(li => li.dataset.clave);
    p.excluidos = lis.filter(li => !li.querySelector('[data-incluir]').checked && !li.classList.contains('sin-doc')).map(li => li.dataset.clave);
    await guardar('portafolios', p);
  };
  cont.querySelector('[data-orden]').addEventListener('click', async (ev) => {
    const b = ev.target.closest('[data-mover]');
    if (!b) return;
    const li = b.closest('li');
    const dir = Number(b.dataset.mover);
    const otro = dir < 0 ? li.previousElementSibling : li.nextElementSibling;
    if (!otro) return;
    if (dir < 0) otro.before(li); else otro.after(li);
    await guardarOrden();
    recargar();
  });
  cont.querySelectorAll('[data-incluir]').forEach(ch => { ch.onchange = guardarOrden; });
  cont.querySelector('[data-restablecer]').onclick = async () => {
    p.orden = []; p.excluidos = [];
    await guardar('portafolios', p);
    recargar();
  };

  // ---- Parcelas ----
  cont.querySelectorAll('[data-quitar-parcela]').forEach(b => {
    b.onclick = async () => {
      if (!await confirmar('¿Quitar esta parcela del portafolio? (La parcela y su contrato no se borran)')) return;
      p.parcelas.splice(Number(b.dataset.quitarParcela), 1);
      await guardar('portafolios', p);
      recargar();
    };
  });
  cont.querySelectorAll('[data-agregar]').forEach(b => {
    b.onclick = () => agregarParcela(p, b.dataset.agregar, recargar);
  });
  cont.querySelectorAll('[data-elegir-contrato]').forEach(b => {
    b.onclick = () => elegirContrato(p, Number(b.dataset.elegirContrato), recargar);
  });

  cont.querySelector('[data-borrar]').onclick = async () => {
    if (!await confirmar('¿Borrar este portafolio? Los documentos de las personas, parcelas y contratos NO se borran.', { si: 'Borrar', peligro: true })) return;
    await borrar('portafolios', id);
    aviso('Portafolio borrado.');
    location.hash = '#/portafolios';
  };

  // ---- PDF ----
  cont.querySelectorAll('[data-armar]').forEach(b => {
    b.onclick = async () => {
      const modo = b.dataset.armar;
      const actual = obtener('portafolios', id);
      const orden = ordenarRenglones(actual, renglonesPortafolio(actual));
      const fuera = new Set(actual.excluidos || []);
      const incluidas = orden.filter(f => f.doc && !fuera.has(f.clave));
      if (!incluidas.length) { aviso('No hay documentos para armar el PDF.', 'error'); return; }
      const faltan = orden.filter(f => !f.doc).length;
      if (faltan && !await confirmar(`Faltan ${faltan} documento(s). ¿Armar el PDF con lo que hay?`, { si: 'Sí, armar' })) return;
      const inverso = modo === 'inverso';
      const r = await conEspera('Armando el PDF…', async () => {
        const archivos = [];
        for (const f of incluidas) {
          for (const a of f.doc.archivos) archivos.push({ bytes: await leerArchivo(a.id), mime: a.mime, titulo: f.etiqueta });
        }
        return unirEnPDF(archivos, { inverso, titulo: `Portafolio ${nombrePersona(actual.agricultorId)} ${actual.ciclo}` });
      });
      if (r.errores.length) aviso(`No se pudieron agregar: ${r.errores.join(', ')}`, 'error');
      const blob = new Blob([r.bytes], { type: 'application/pdf' });
      const nombre = `PORTAFOLIO_${nombreArchivo(nombrePersona(actual.agricultorId))}_${nombreArchivo(actual.ciclo)}${inverso ? '_INVERSO' : ''}.pdf`;
      if (modo === 'ver') abrirEnPestana(blob);
      else if (modo === 'compartir') { if (!await compartir(blob, nombre)) descargar(blob, nombre); }
      else descargar(blob, nombre);
      aviso(`PDF listo: ${r.paginas} hoja(s).`);
    };
  });
}

function agregarParcela(p, modo, listo) {
  let opciones;
  if (modo === 'propia') {
    const ps = lista('parcelas').sort((a, b) => (a.propietarioId === p.agricultorId ? -1 : 1) - (b.propietarioId === p.agricultorId ? -1 : 1));
    opciones = ps.map(x => `<option value="${esc(x.id)}|">${esc(nombrePersona(x.propietarioId))} · ${esc(describirParcela(x))}</option>`).join('');
  } else {
    const cs = lista('contratos').sort((a, b) => (a.inversionistaId === p.agricultorId ? -1 : 1) - (b.inversionistaId === p.agricultorId ? -1 : 1));
    opciones = cs.map(c => `<option value="${esc(c.parcelaId || '')}|${esc(c.id)}">${esc(describirContrato(c))}</option>`).join('');
  }
  const volver = encodeURIComponent(`#/portafolio/${p.id}/ligar?parcela={id}`);
  const m = abrirModal(modo === 'propia' ? 'Agregar parcela propia' : 'Agregar parcela rentada', `
    <form class="formulario">
      <label class="campo">${modo === 'propia' ? 'Parcela' : 'Contrato'}
        <select name="sel" required><option value="">— Elegir —</option>${opciones}</select></label>
      ${modo === 'propia' ? `<a class="btn btn-chico" href="#/parcela/nueva?propietario=${esc(p.agricultorId)}&volver=${volver}">➕ Registrar parcela nueva</a>` : ''}
      <div class="acciones"><button type="submit" class="btn btn-primario">Agregar</button></div>
    </form>`);
  m.cuerpo.querySelectorAll('a').forEach(a => a.addEventListener('click', () => m.cerrar()));
  m.cuerpo.querySelector('form').onsubmit = async (ev) => {
    ev.preventDefault();
    const [parcelaId, contratoId] = ev.target.sel.value.split('|');
    p.parcelas = p.parcelas || [];
    p.parcelas.push({ modo, parcelaId, contratoId: contratoId || '' });
    await guardar('portafolios', p);
    m.cerrar();
    listo();
  };
}

function elegirContrato(p, i, listo) {
  const pp = p.parcelas[i];
  const cs = lista('contratos').filter(c => !pp.parcelaId || c.parcelaId === pp.parcelaId);
  const m = abrirModal('Elegir contrato', `
    <form class="formulario">
      <label class="campo">Contrato <select name="sel" required><option value="">— Elegir —</option>
        ${cs.map(c => `<option value="${esc(c.id)}">${esc(describirContrato(c))}</option>`).join('')}</select></label>
      ${cs.length ? '' : '<p class="vacio">No hay contratos para esta parcela. Usa "Hacer contrato".</p>'}
      <div class="acciones"><button type="submit" class="btn btn-primario">Elegir</button></div>
    </form>`);
  m.cuerpo.querySelector('form').onsubmit = async (ev) => {
    ev.preventDefault();
    pp.contratoId = ev.target.sel.value;
    await guardar('portafolios', p);
    m.cerrar();
    listo();
  };
}
