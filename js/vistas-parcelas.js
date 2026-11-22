// =====================================================================
// vistas-parcelas.js — Parcelas: dueño, superficie, colindancias y
// su documento de propiedad (certificado parcelario o carta notariada).
// =====================================================================

import { VALORES_POR_DEFECTO } from './config.js';
import { guardar, obtener, lista, borrar, borrarDocumento } from './almacen.js';
import { describirParcela, nombrePersona, documentosDe, describirContrato } from './logica.js';
import { selectorPersona, enlazarSelectoresPersona } from './vistas-personas.js';
import { renglonDocumento } from './vistas-documentos.js';
import { aviso, confirmar, valoresFormulario } from './ui.js';
import { esc, mayus, normalizar } from './util.js';

export function vistaParcelas(cont) {
  cont.innerHTML = `
    <div class="cabeza-vista">
      <h1>Parcelas</h1>
      <a class="btn btn-primario" href="#/parcela/nueva">➕ Nueva parcela</a>
    </div>
    <input type="search" class="filtro" placeholder="Filtrar por dueño, ejido, número…" data-filtro>
    <div class="tarjetas" data-lista></div>`;
  const pintar = () => {
    const q = normalizar(cont.querySelector('[data-filtro]').value);
    const parcelas = lista('parcelas')
      .map(p => ({ p, dueno: nombrePersona(p.propietarioId) }))
      .filter(({ p, dueno }) => !q || normalizar(`${dueno} ${p.ejido} ${p.numero} ${p.certificado}`).includes(q))
      .sort((a, b) => a.dueno.localeCompare(b.dueno, 'es'));
    cont.querySelector('[data-lista]').innerHTML = parcelas.map(({ p, dueno }) => {
      const tieneDoc = documentosDe('parcelaId', p.id).length > 0;
      return `<a class="tarjeta" href="#/parcela/${esc(p.id)}">
        <strong>${esc(describirParcela(p))}</strong>
        <small>Dueño: ${esc(dueno)}</small>
        <span class="pastilla ${tieneDoc ? 'pastilla-ok' : 'pastilla-mal'}">${tieneDoc ? 'Con documento de propiedad' : 'Falta documento de propiedad'}</span>
      </a>`;
    }).join('') || '<p class="vacio">No hay parcelas registradas.</p>';
  };
  cont.querySelector('[data-filtro]').oninput = pintar;
  pintar();
}

/** Formulario de parcela (pantalla completa). */
export function vistaParcelaFormulario(cont, id, params) {
  const p = id ? obtener('parcelas', id) : {
    propietarioId: params.get('propietario') || '',
    municipio: VALORES_POR_DEFECTO.municipio, estado: VALORES_POR_DEFECTO.estado,
    colindancias: {},
  };
  if (!p) { cont.innerHTML = '<p class="vacio">Esta parcela ya no existe.</p>'; return; }
  const col = p.colindancias || {};
  cont.innerHTML = `
    <div class="cabeza-vista"><div><a href="${id ? `#/parcela/${esc(id)}` : '#/parcelas'}" class="volver">‹ Regresar</a>
      <h1>${id ? 'Editar parcela' : 'Nueva parcela'}</h1></div></div>
    <form class="formulario panel">
      <label class="campo">Dueño de la parcela ${selectorPersona('propietarioId', p.propietarioId)}</label>
      <div class="fila">
        <label class="campo">Número de parcela <input name="numero" value="${esc(p.numero || '')}"></label>
        <label class="campo">Núm. de certificado parcelario <input name="certificado" value="${esc(p.certificado || '')}"></label>
      </div>
      <div class="fila">
        <label class="campo">Superficie (hectáreas) <input name="superficie" required inputmode="decimal" value="${esc(p.superficie || '')}" placeholder="6.05"></label>
        <label class="campo">Ejido <input name="ejido" required value="${esc(p.ejido || '')}" placeholder="LA BRECHA" autocapitalize="characters"></label>
      </div>
      <div class="fila">
        <label class="campo">Municipio <input name="municipio" value="${esc(p.municipio || '')}" autocapitalize="characters"></label>
        <label class="campo">Estado <input name="estado" value="${esc(p.estado || '')}" autocapitalize="characters"></label>
      </div>
      <fieldset>
        <legend>Colindancias <small>(como deben ir en el contrato)</small></legend>
        <label class="campo">Al norte <input name="norte" value="${esc(col.norte || '')}" placeholder="MIGUEL ACOSTA"></label>
        <label class="campo">Al sur <input name="sur" value="${esc(col.sur || '')}" placeholder="CANAL CERVANTES"></label>
        <label class="campo">Al este <input name="este" value="${esc(col.este || '')}"></label>
        <label class="campo">Al oeste <input name="oeste" value="${esc(col.oeste || '')}"></label>
      </fieldset>
      <label class="campo">Notas <textarea name="notas" rows="2">${esc(p.notas || '')}</textarea></label>
      <div class="acciones"><button type="submit" class="btn btn-primario">Guardar parcela</button></div>
    </form>`;
  const form = cont.querySelector('form');
  enlazarSelectoresPersona(form);
  form.onsubmit = async (ev) => {
    ev.preventDefault();
    const v = valoresFormulario(form);
    const reg = {
      ...p,
      propietarioId: v.propietarioId,
      numero: v.numero, certificado: v.certificado,
      superficie: v.superficie.replace(',', '.'),
      ejido: mayus(v.ejido), municipio: mayus(v.municipio), estado: mayus(v.estado),
      colindancias: { norte: mayus(v.norte), sur: mayus(v.sur), este: mayus(v.este), oeste: mayus(v.oeste) },
      notas: v.notas,
    };
    const guardada = await guardar('parcelas', reg);
    aviso('Parcela guardada.');
    const volver = new URLSearchParams(location.hash.split('?')[1] || '').get('volver');
    location.hash = volver ? volver.replace('{id}', guardada.id) : `#/parcela/${guardada.id}`;
  };
}

export function vistaParcela(cont, id) {
  const p = obtener('parcelas', id);
  if (!p) { cont.innerHTML = '<p class="vacio">Esta parcela ya no existe.</p>'; return; }
  const col = p.colindancias || {};
  const contratos = lista('contratos').filter(c => c.parcelaId === id);
  const portafolios = lista('portafolios').filter(x => (x.parcelas || []).some(pp => pp.parcelaId === id));
  cont.innerHTML = `
    <div class="cabeza-vista">
      <div><a href="#/parcelas" class="volver">‹ Parcelas</a><h1>${esc(describirParcela(p))}</h1></div>
      <div class="botones-fila">
        <a class="btn" href="#/parcela/${esc(id)}/editar">Editar</a>
        <button class="btn btn-peligro" data-borrar>Borrar</button>
      </div>
    </div>
    <div class="datos">
      <div><span>Dueño</span><a href="#/persona/${esc(p.propietarioId)}">${esc(nombrePersona(p.propietarioId))}</a></div>
      <div><span>Superficie</span>${esc(p.superficie)} ha</div>
      <div><span>Ejido</span>${esc(p.ejido)}</div>
      <div><span>Municipio</span>${esc([p.municipio, p.estado].filter(Boolean).join(', '))}</div>
      ${p.numero ? `<div><span>Núm. parcela</span>${esc(p.numero)}</div>` : ''}
      ${p.certificado ? `<div><span>Núm. certificado</span>${esc(p.certificado)}</div>` : ''}
      <div class="ancho"><span>Colindancias</span>Norte: ${esc(col.norte || '—')} · Sur: ${esc(col.sur || '—')} · Este: ${esc(col.este || '—')} · Oeste: ${esc(col.oeste || '—')}</div>
    </div>
    <section class="panel">
      <h2>Documento de propiedad</h2>
      ${renglonDocumento({ etiqueta: 'Certificado parcelario o carta notariada', campo: 'parcelaId', id, tipos: ['CERTIFICADO', 'CARTA'] })}
    </section>
    <section class="panel">
      <h2>Contratos de esta parcela</h2>
      ${contratos.map(c => `<a class="renglon" href="#/contrato/${esc(c.id)}">${esc(describirContrato(c))}</a>`).join('') || '<p class="vacio">Ninguno.</p>'}
      <a class="btn" href="#/contrato/nuevo?parcela=${esc(id)}">➕ Hacer contrato de arrendamiento</a>
    </section>
    ${portafolios.length ? `<section class="panel"><h2>Portafolios donde aparece</h2>
      ${portafolios.map(x => `<a class="renglon" href="#/portafolio/${esc(x.id)}">${esc(nombrePersona(x.agricultorId))} · ${esc(x.ciclo)}</a>`).join('')}</section>` : ''}`;

  cont.querySelector('[data-borrar]').onclick = async () => {
    if (!await confirmar(`¿Borrar esta parcela y su documento de propiedad?${contratos.length ? ' Tiene contratos que quedarán sin parcela.' : ''}`, { si: 'Borrar', peligro: true })) return;
    for (const d of documentosDe('parcelaId', id)) await borrarDocumento(d.id);
    await borrar('parcelas', id);
    aviso('Parcela borrada.');
    location.hash = '#/parcelas';
  };
}
