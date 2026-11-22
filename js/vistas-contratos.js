// =====================================================================
// vistas-contratos.js — Contratos de arrendamiento
// ---------------------------------------------------------------------
// Se llenan los datos (casi todo se toma de la parcela y las personas ya
// registradas) y se genera el PDF exactamente con el formato.
// Después se sube el contrato YA FIRMADO (escaneado o en fotos).
// =====================================================================

import { VALORES_POR_DEFECTO } from './config.js';
import { guardar, obtener, lista, borrar, borrarDocumento } from './almacen.js';
import { describirParcela, describirContrato, nombrePersona, documentosDe } from './logica.js';
import { selectorPersona, enlazarSelectoresPersona } from './vistas-personas.js';
import { renglonDocumento } from './vistas-documentos.js';
import { generarContratoPDF } from './contrato.js';
import { aviso, confirmar, conEspera, valoresFormulario } from './ui.js';
import {
  esc, mayus, normalizar, montoConLetra, formatoPesos, fechaCorta, aFecha,
  descargar, abrirEnPestana, compartir, nombreArchivo,
} from './util.js';

export function vistaContratos(cont) {
  cont.innerHTML = `
    <div class="cabeza-vista">
      <h1>Contratos de arrendamiento</h1>
      <a class="btn btn-primario" href="#/contrato/nuevo">➕ Nuevo contrato</a>
    </div>
    <input type="search" class="filtro" placeholder="Filtrar por nombre, ciclo, ejido…" data-filtro>
    <div class="tarjetas" data-lista></div>`;
  const pintar = () => {
    const q = normalizar(cont.querySelector('[data-filtro]').value);
    const contratos = lista('contratos')
      .filter(c => !q || normalizar(`${describirContrato(c)} ${c.ejido} ${nombrePersona(c.testigo1Id)} ${nombrePersona(c.testigo2Id)}`).includes(q))
      .sort((a, b) => (b.fechaFirma || '').localeCompare(a.fechaFirma || ''));
    cont.querySelector('[data-lista]').innerHTML = contratos.map(c => {
      const firmado = documentosDe('contratoId', c.id).some(d => d.tipo === 'CONTRATO_FIRMADO');
      return `<a class="tarjeta" href="#/contrato/${esc(c.id)}">
        <strong>${esc(nombrePersona(c.parceleroId))}</strong>
        <small>Inversionista: ${esc(nombrePersona(c.inversionistaId))}</small>
        <small>${esc(c.ciclo)} · ${esc(c.hectareas)} ha · ${esc(formatoPesos(c.monto))}</small>
        <span class="pastilla ${firmado ? 'pastilla-ok' : 'pastilla-mal'}">${firmado ? 'Firmado subido' : 'Falta subir firmado'}</span>
      </a>`;
    }).join('') || '<p class="vacio">No hay contratos.</p>';
  };
  cont.querySelector('[data-filtro]').oninput = pintar;
  pintar();
}

function selectorParcela(seleccionada) {
  const parcelas = lista('parcelas')
    .map(p => ({ p, dueno: nombrePersona(p.propietarioId) }))
    .sort((a, b) => a.dueno.localeCompare(b.dueno, 'es'));
  return `<select name="parcelaId" data-parcela>
    <option value="">— Elegir parcela (llena los datos solo) —</option>
    ${parcelas.map(({ p, dueno }) => `<option value="${esc(p.id)}" ${p.id === seleccionada ? 'selected' : ''}>${esc(dueno)} · ${esc(describirParcela(p))}</option>`).join('')}
  </select>`;
}

function aniosEntre(inicio, fin) {
  const a = aFecha(inicio), b = aFecha(fin);
  if (!a || !b) return '';
  return Math.max(1, Math.round((b - a) / (365.25 * 86400000)));
}

/** Formulario del contrato (nuevo, editar o duplicar). */
export function vistaContratoFormulario(cont, id, params) {
  const base = id ? obtener('contratos', id) : null;
  const duplicar = params.get('duplicar') ? obtener('contratos', params.get('duplicar')) : null;
  if (id && !base) { cont.innerHTML = '<p class="vacio">Este contrato ya no existe.</p>'; return; }
  const c = base ? { ...base } : duplicar ? { ...duplicar, id: undefined, creado: undefined, fechaInicio: '', fechaFin: '', fechaFirma: '', ciclo: '', anios: '' } : {
    cultivo: VALORES_POR_DEFECTO.cultivo,
    municipio: VALORES_POR_DEFECTO.municipio, estado: VALORES_POR_DEFECTO.estado,
    inversionistaId: params.get('inversionista') || '',
    colindancias: {},
  };
  const col = c.colindancias || {};
  const volverA = params.get('volver');
  const aqui = encodeURIComponent(`#/contrato/nuevo?parcela={id}${c.inversionistaId ? `&inversionista=${c.inversionistaId}` : ''}${volverA ? `&volver=${encodeURIComponent(volverA)}` : ''}`);

  cont.innerHTML = `
    <div class="cabeza-vista"><div><a href="${id ? `#/contrato/${esc(id)}` : '#/contratos'}" class="volver">‹ Regresar</a>
      <h1>${id ? 'Editar contrato' : 'Nuevo contrato de arrendamiento'}</h1></div></div>
    <form class="formulario panel">
      <fieldset>
        <legend>Parcela</legend>
        <label class="campo">Parcela que se renta ${selectorParcela(c.parcelaId || params.get('parcela'))}</label>
        <a class="btn btn-chico" href="#/parcela/nueva?volver=${aqui}">➕ Registrar parcela nueva</a>
        <div class="fila">
          <label class="campo">Hectáreas <input name="hectareas" required inputmode="decimal" value="${esc(c.hectareas || '')}"></label>
          <label class="campo">Ejido <input name="ejido" required value="${esc(c.ejido || '')}" autocapitalize="characters"></label>
        </div>
        <div class="fila">
          <label class="campo">Colinda al norte <input name="norte" value="${esc(col.norte || '')}"></label>
          <label class="campo">Colinda al sur <input name="sur" value="${esc(col.sur || '')}"></label>
        </div>
        <div class="fila">
          <label class="campo">Colinda al este <input name="este" value="${esc(col.este || '')}"></label>
          <label class="campo">Colinda al oeste <input name="oeste" value="${esc(col.oeste || '')}"></label>
        </div>
      </fieldset>
      <fieldset>
        <legend>Personas que firman</legend>
        <label class="campo">El parcelero (dueño que renta) ${selectorPersona('parceleroId', c.parceleroId)}</label>
        <label class="campo">El inversionista (agricultor que siembra) ${selectorPersona('inversionistaId', c.inversionistaId)}</label>
        <div class="fila">
          <label class="campo">Testigo 1 ${selectorPersona('testigo1Id', c.testigo1Id)}</label>
          <label class="campo">Testigo 2 <small>(síndico / comisariado)</small> ${selectorPersona('testigo2Id', c.testigo2Id)}</label>
        </div>
      </fieldset>
      <fieldset>
        <legend>Condiciones</legend>
        <div class="fila">
          <label class="campo">Fecha de inicio <input type="date" name="fechaInicio" required value="${esc(c.fechaInicio || '')}"></label>
          <label class="campo">Fecha de terminación <input type="date" name="fechaFin" required value="${esc(c.fechaFin || '')}"></label>
          <label class="campo">Duración (años) <input type="number" name="anios" min="1" required value="${esc(c.anios || '')}"></label>
        </div>
        <div class="fila">
          <label class="campo">Ciclo <input name="ciclo" required value="${esc(c.ciclo || '')}" placeholder="O-I 2026 - 2029"></label>
          <label class="campo">Cultivo <input name="cultivo" required value="${esc(c.cultivo || '')}" autocapitalize="characters"></label>
        </div>
        <label class="campo">Cantidad de la renta (pesos) <input name="monto" required inputmode="decimal" value="${esc(c.monto || '')}" placeholder="180000"></label>
        <label class="campo">Cantidad con letra <small>(se llena sola; puedes corregirla)</small>
          <input name="montoLetra" value="${esc(c.montoLetra || '')}"></label>
      </fieldset>
      <fieldset>
        <legend>Lugar y fecha de firma</legend>
        <div class="fila">
          <label class="campo">Ejido <input name="lugarEjido" required value="${esc(c.lugarEjido || '')}" autocapitalize="characters"></label>
          <label class="campo">Municipio <input name="municipio" required value="${esc(c.municipio || '')}" autocapitalize="characters"></label>
          <label class="campo">Estado <input name="estado" required value="${esc(c.estado || '')}" autocapitalize="characters"></label>
        </div>
        <label class="campo">Fecha de firma <input type="date" name="fechaFirma" required value="${esc(c.fechaFirma || '')}"></label>
      </fieldset>
      <div class="acciones">
        <button type="submit" class="btn btn-primario">Guardar y ver contrato</button>
      </div>
    </form>`;

  const form = cont.querySelector('form');
  enlazarSelectoresPersona(form);

  const llenarDesdeParcela = () => {
    const p = obtener('parcelas', form.parcelaId.value);
    if (!p) return;
    form.parceleroId.value = p.propietarioId || '';
    form.hectareas.value = p.superficie || '';
    form.ejido.value = p.ejido || '';
    const k = p.colindancias || {};
    form.norte.value = k.norte || ''; form.sur.value = k.sur || '';
    form.este.value = k.este || ''; form.oeste.value = k.oeste || '';
    form.lugarEjido.value = p.ejido || form.lugarEjido.value;
    form.municipio.value = p.municipio || form.municipio.value;
    form.estado.value = p.estado || form.estado.value;
  };
  form.parcelaId.onchange = llenarDesdeParcela;
  if (!id && !duplicar && params.get('parcela')) llenarDesdeParcela();

  const alCambiarMonto = () => {
    const n = Number(form.monto.value.replace(/[$,\s]/g, ''));
    form.montoLetra.value = n ? montoConLetra(n) : '';
  };
  form.monto.oninput = alCambiarMonto;
  if (form.monto.value && !form.montoLetra.value) alCambiarMonto();

  const alCambiarFechas = () => {
    const a = aniosEntre(form.fechaInicio.value, form.fechaFin.value);
    if (a) form.anios.value = a;
    if (form.fechaInicio.value && form.fechaFin.value && !form.ciclo.dataset.tocado) {
      form.ciclo.value = `O-I ${form.fechaInicio.value.slice(0, 4)} - ${form.fechaFin.value.slice(0, 4)}`;
    }
    if (form.fechaInicio.value && !form.fechaFirma.dataset.tocado) form.fechaFirma.value = form.fechaInicio.value;
  };
  form.fechaInicio.onchange = alCambiarFechas;
  form.fechaFin.onchange = alCambiarFechas;
  form.ciclo.oninput = () => { form.ciclo.dataset.tocado = '1'; };
  form.fechaFirma.oninput = () => { form.fechaFirma.dataset.tocado = '1'; };
  if (c.ciclo) form.ciclo.dataset.tocado = '1';
  if (c.fechaFirma) form.fechaFirma.dataset.tocado = '1';

  form.onsubmit = async (ev) => {
    ev.preventDefault();
    const v = valoresFormulario(form);
    const firmantes = [v.parceleroId, v.inversionistaId, v.testigo1Id, v.testigo2Id];
    if (firmantes.some(x => !x || x === '__nueva')) { aviso('Elige a las 4 personas que firman.', 'error'); return; }
    if (new Set(firmantes).size < 4 && !await confirmar('Hay una persona repetida entre los que firman. ¿Continuar?')) return;
    const reg = {
      ...c,
      parcelaId: v.parcelaId || '',
      parceleroId: v.parceleroId, inversionistaId: v.inversionistaId,
      testigo1Id: v.testigo1Id, testigo2Id: v.testigo2Id,
      hectareas: v.hectareas.replace(',', '.'), ejido: mayus(v.ejido),
      colindancias: { norte: mayus(v.norte), sur: mayus(v.sur), este: mayus(v.este), oeste: mayus(v.oeste) },
      fechaInicio: v.fechaInicio, fechaFin: v.fechaFin, anios: Number(v.anios),
      ciclo: mayus(v.ciclo), cultivo: mayus(v.cultivo),
      monto: Number(v.monto.replace(/[$,\s]/g, '')), montoLetra: mayus(v.montoLetra),
      lugarEjido: mayus(v.lugarEjido), municipio: mayus(v.municipio), estado: mayus(v.estado),
      fechaFirma: v.fechaFirma,
    };
    const guardado = await guardar('contratos', reg);
    aviso('Contrato guardado.');
    location.hash = volverA ? volverA.replace('{id}', guardado.id) : `#/contrato/${guardado.id}`;
  };
}

/** Datos que necesita el generador de PDF. */
export function datosParaPDF(c) {
  const parcelero = obtener('personas', c.parceleroId);
  return {
    parcelero: parcelero?.nombre || '', sexoParcelero: parcelero?.sexo || 'H',
    inversionista: nombrePersona(c.inversionistaId),
    hectareas: c.hectareas, ejido: c.ejido, ciclo: c.ciclo, cultivo: c.cultivo,
    monto: c.monto, montoLetra: c.montoLetra, colindancias: c.colindancias,
    anios: c.anios, fechaInicio: c.fechaInicio, fechaFin: c.fechaFin,
    lugarEjido: c.lugarEjido, municipio: c.municipio, estado: c.estado, fechaFirma: c.fechaFirma,
  };
}

export function nombrePDFContrato(c) {
  return `CONTRATO_-_${nombreArchivo(nombrePersona(c.parceleroId))}.pdf`;
}

export function vistaContrato(cont, id) {
  const c = obtener('contratos', id);
  if (!c) { cont.innerHTML = '<p class="vacio">Este contrato ya no existe.</p>'; return; }
  const parcela = obtener('parcelas', c.parcelaId);
  const col = c.colindancias || {};
  const ine = (pid, papel) => renglonDocumento({ etiqueta: `INE ${papel}: ${nombrePersona(pid)}`, campo: 'personaId', id: pid, tipos: ['INE'] });
  cont.innerHTML = `
    <div class="cabeza-vista">
      <div><a href="#/contratos" class="volver">‹ Contratos</a><h1>Contrato: ${esc(nombrePersona(c.parceleroId))}</h1></div>
      <div class="botones-fila">
        <a class="btn" href="#/contrato/${esc(id)}/editar">Editar</a>
        <a class="btn" href="#/contrato/nuevo?duplicar=${esc(id)}" title="Copia los datos para un ciclo nuevo">Duplicar</a>
        <button class="btn btn-peligro" data-borrar>Borrar</button>
      </div>
    </div>
    <section class="panel resaltado">
      <h2>Contrato en PDF (para imprimir y firmar)</h2>
      <div class="botones-fila">
        <button class="btn btn-primario" data-pdf="ver">🖨️ Ver / Imprimir</button>
        <button class="btn" data-pdf="descargar">⬇️ Guardar PDF</button>
        <button class="btn" data-pdf="compartir">📤 Compartir</button>
      </div>
    </section>
    <div class="datos">
      <div><span>Parcelero</span><a href="#/persona/${esc(c.parceleroId)}">${esc(nombrePersona(c.parceleroId))}</a></div>
      <div><span>Inversionista</span><a href="#/persona/${esc(c.inversionistaId)}">${esc(nombrePersona(c.inversionistaId))}</a></div>
      <div><span>Testigos</span>${esc(nombrePersona(c.testigo1Id))} · ${esc(nombrePersona(c.testigo2Id))}</div>
      <div><span>Parcela</span>${parcela ? `<a href="#/parcela/${esc(parcela.id)}">${esc(describirParcela(parcela))}</a>` : `${esc(c.hectareas)} ha · Ejido ${esc(c.ejido)}`}</div>
      <div><span>Ciclo / cultivo</span>${esc(c.ciclo)} · ${esc(c.cultivo)}</div>
      <div><span>Renta</span>${esc(formatoPesos(c.monto))}</div>
      <div><span>Vigencia</span>${esc(fechaCorta(c.fechaInicio))} al ${esc(fechaCorta(c.fechaFin))} (${esc(c.anios)} año${c.anios == 1 ? '' : 's'})</div>
      <div><span>Firma</span>${esc(c.lugarEjido)}, ${esc(fechaCorta(c.fechaFirma))}</div>
      <div class="ancho"><span>Colindancias</span>N: ${esc(col.norte || '—')} · S: ${esc(col.sur || '—')} · E: ${esc(col.este || '—')} · O: ${esc(col.oeste || '—')}</div>
    </div>
    <section class="panel">
      <h2>Documentos que deben ir con el contrato</h2>
      ${renglonDocumento({ etiqueta: 'Contrato firmado (escaneado o fotos)', campo: 'contratoId', id, tipos: ['CONTRATO_FIRMADO'] })}
      ${ine(c.parceleroId, 'parcelero')}
      ${ine(c.inversionistaId, 'inversionista')}
      ${ine(c.testigo1Id, 'testigo')}
      ${ine(c.testigo2Id, 'testigo')}
      ${parcela ? renglonDocumento({ etiqueta: 'Certificado parcelario / documento de propiedad', campo: 'parcelaId', id: parcela.id, tipos: ['CERTIFICADO', 'CARTA'] })
        : '<p class="vacio">Este contrato no está ligado a una parcela registrada; el documento de propiedad se sube en la parcela.</p>'}
    </section>`;

  const pdf = async () => {
    const bytes = await conEspera('Generando contrato…', () => generarContratoPDF(datosParaPDF(c)));
    return new Blob([bytes], { type: 'application/pdf' });
  };
  cont.querySelectorAll('[data-pdf]').forEach(b => {
    b.onclick = async () => {
      const blob = await pdf();
      const nombre = nombrePDFContrato(c);
      if (b.dataset.pdf === 'ver') abrirEnPestana(blob);
      else if (b.dataset.pdf === 'descargar') descargar(blob, nombre);
      else if (!await compartir(blob, nombre)) descargar(blob, nombre);
    };
  });
  cont.querySelector('[data-borrar]').onclick = async () => {
    const enPortafolios = lista('portafolios').filter(p => (p.parcelas || []).some(pp => pp.contratoId === id));
    if (!await confirmar(`¿Borrar este contrato y su copia firmada?${enPortafolios.length ? ` Está en ${enPortafolios.length} portafolio(s).` : ''}`, { si: 'Borrar', peligro: true })) return;
    for (const d of documentosDe('contratoId', id)) await borrarDocumento(d.id);
    await borrar('contratos', id);
    aviso('Contrato borrado.');
    location.hash = '#/contratos';
  };
}
