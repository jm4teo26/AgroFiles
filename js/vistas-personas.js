// =====================================================================
// vistas-personas.js — Registro de personas y sus documentos
// ---------------------------------------------------------------------
// Una persona se registra UNA sola vez con sus documentos. Después,
// cuando aparece en un contrato o portafolio, sus documentos se toman
// de aquí automáticamente.
// =====================================================================

import { TIPOS_DOCUMENTO } from './config.js';
import { guardar, obtener, lista, borrar, borrarDocumento } from './almacen.js';
import {
  personasOrdenadas, documentosDe, describirParcela, describirContrato,
} from './logica.js';
import { renglonDocumento, documentosExtra, subirDocumento } from './vistas-documentos.js';
import { abrirModal, aviso, confirmar, valoresFormulario } from './ui.js';
import { esc, mayus, normalizar } from './util.js';

const TIPOS_PERSONALES = ['ACTA', 'CURP', 'INE', 'CSF', 'OPINION'];

// ---------------------------------------------------------------------
// Selector de persona reutilizable (con opción "+ Nueva persona")
// ---------------------------------------------------------------------
export function selectorPersona(nombre, seleccionado, { requerido = true } = {}) {
  const opciones = personasOrdenadas().map(p =>
    `<option value="${esc(p.id)}" ${p.id === seleccionado ? 'selected' : ''}>${esc(p.nombre)}${p.curp ? ' · ' + esc(p.curp) : ''}</option>`).join('');
  return `<select name="${esc(nombre)}" data-selector-persona ${requerido ? 'required' : ''}>
    <option value="">— Elegir —</option>${opciones}
    <option value="__nueva">➕ Registrar persona nueva…</option></select>`;
}

/** Activa la opción "+ Nueva persona" en los selectores de un formulario. */
export function enlazarSelectoresPersona(raiz) {
  raiz.querySelectorAll('[data-selector-persona]').forEach(sel => {
    let anterior = sel.value;
    sel.addEventListener('change', async () => {
      if (sel.value !== '__nueva') { anterior = sel.value; sel.dispatchEvent(new Event('persona-elegida')); return; }
      const nueva = await formularioPersona();
      // Volver a pintar todos los selectores con la persona nueva incluida.
      raiz.querySelectorAll('[data-selector-persona]').forEach(otro => {
        const valor = otro === sel ? (nueva?.id || anterior) : otro.value;
        const temp = document.createElement('div');
        temp.innerHTML = selectorPersona(otro.name, valor, { requerido: otro.required });
        otro.innerHTML = temp.firstElementChild.innerHTML;
        otro.value = valor;
      });
      anterior = sel.value;
      sel.dispatchEvent(new Event('persona-elegida'));
    });
  });
}

// ---------------------------------------------------------------------
// Formulario de persona (nueva o editar). Devuelve la persona guardada.
// ---------------------------------------------------------------------
export function formularioPersona(persona = null) {
  const p = persona || {};
  return new Promise((resolver) => {
    const m = abrirModal(persona ? 'Editar persona' : 'Nueva persona', `
      <form class="formulario">
        <label class="campo">Nombre completo <small>(como va en el contrato: APELLIDOS Y NOMBRE)</small>
          <input name="nombre" required value="${esc(p.nombre || '')}" placeholder="RUELAS FLORES MARCO ANTONIO" autocapitalize="characters"></label>
        <div class="campo">Sexo <small>(para poner "EL SEÑOR" o "LA SEÑORA" en el contrato)</small>
          <div class="opciones">
            <label><input type="radio" name="sexo" value="H" ${p.sexo !== 'M' ? 'checked' : ''}> Hombre</label>
            <label><input type="radio" name="sexo" value="M" ${p.sexo === 'M' ? 'checked' : ''}> Mujer</label>
          </div></div>
        <div class="fila">
          <label class="campo">CURP <input name="curp" value="${esc(p.curp || '')}" maxlength="18" autocapitalize="characters"></label>
          <label class="campo">RFC <input name="rfc" value="${esc(p.rfc || '')}" maxlength="13" autocapitalize="characters"></label>
        </div>
        <div class="fila">
          <label class="campo">Teléfono <input name="telefono" type="tel" value="${esc(p.telefono || '')}"></label>
          <label class="campo">Cargo / papel <small>(ej. Comisariado ejidal, Síndico)</small> <input name="cargo" value="${esc(p.cargo || '')}"></label>
        </div>
        <label class="campo">Domicilio <input name="domicilio" value="${esc(p.domicilio || '')}"></label>
        <label class="campo">Notas <textarea name="notas" rows="2">${esc(p.notas || '')}</textarea></label>
        <div class="acciones">
          <button type="button" class="btn" data-cancelar>Cancelar</button>
          <button type="submit" class="btn btn-primario">Guardar</button>
        </div>
      </form>`, { alCerrar: v => resolver(v || null) });
    const form = m.cuerpo.querySelector('form');
    form.querySelector('[data-cancelar]').onclick = () => m.cerrar(null);
    form.onsubmit = async (ev) => {
      ev.preventDefault();
      const v = valoresFormulario(form);
      v.nombre = mayus(v.nombre).replace(/\s+/g, ' ');
      v.curp = mayus(v.curp);
      v.rfc = mayus(v.rfc);
      // Aviso de posible duplicado.
      const repetida = lista('personas').find(o => o.id !== p.id &&
        ((v.curp && o.curp === v.curp) || normalizar(o.nombre) === normalizar(v.nombre)));
      if (repetida && !await confirmar(`Ya existe "${repetida.nombre}"${repetida.curp ? ' con CURP ' + repetida.curp : ''}. ¿Guardar de todos modos?`, { si: 'Guardar' })) return;
      const guardada = await guardar('personas', { ...p, ...v });
      aviso('Persona guardada.');
      m.cerrar(guardada);
    };
  });
}

// ---------------------------------------------------------------------
// Pantalla: lista de personas
// ---------------------------------------------------------------------
export function vistaPersonas(cont) {
  cont.innerHTML = `
    <div class="cabeza-vista">
      <h1>Personas</h1>
      <button class="btn btn-primario" data-nueva>➕ Nueva persona</button>
    </div>
    <input type="search" class="filtro" placeholder="Filtrar por nombre, CURP o RFC…" data-filtro>
    <div class="tarjetas" data-lista></div>`;
  const pintar = () => {
    const q = normalizar(cont.querySelector('[data-filtro]').value);
    const personas = personasOrdenadas().filter(p => !q || normalizar(`${p.nombre} ${p.curp} ${p.rfc} ${p.cargo}`).includes(q));
    cont.querySelector('[data-lista]').innerHTML = personas.map(p => {
      const docs = documentosDe('personaId', p.id);
      const tiene = TIPOS_PERSONALES.filter(t => docs.some(d => d.tipo === t)).length;
      return `<a class="tarjeta" href="#/persona/${esc(p.id)}">
        <strong>${esc(p.nombre)}</strong>
        <small>${esc([p.curp, p.cargo].filter(Boolean).join(' · ') || 'Sin CURP')}</small>
        <span class="pastilla ${tiene === TIPOS_PERSONALES.length ? 'pastilla-ok' : ''}">${tiene}/${TIPOS_PERSONALES.length} documentos</span>
      </a>`;
    }).join('') || '<p class="vacio">No hay personas registradas.</p>';
  };
  cont.querySelector('[data-filtro]').oninput = pintar;
  cont.querySelector('[data-nueva]').onclick = async () => {
    const p = await formularioPersona();
    if (p) location.hash = `#/persona/${p.id}`;
  };
  pintar();
}

// ---------------------------------------------------------------------
// Pantalla: detalle de una persona
// ---------------------------------------------------------------------
export function vistaPersona(cont, id) {
  const p = obtener('personas', id);
  if (!p) { cont.innerHTML = '<p class="vacio">Esta persona ya no existe.</p>'; return; }
  const docs = documentosDe('personaId', id);
  const otros = docs.filter(d => d.tipo === 'OTRO');
  const parcelas = lista('parcelas').filter(x => x.propietarioId === id);
  const contratos = lista('contratos').filter(c => [c.parceleroId, c.inversionistaId, c.testigo1Id, c.testigo2Id].includes(id));
  const portafolios = lista('portafolios').filter(x => x.agricultorId === id);

  cont.innerHTML = `
    <div class="cabeza-vista">
      <div><a href="#/personas" class="volver">‹ Personas</a><h1>${esc(p.nombre)}</h1></div>
      <div class="botones-fila">
        <button class="btn" data-editar>Editar datos</button>
        <button class="btn btn-peligro" data-borrar>Borrar</button>
      </div>
    </div>
    <div class="datos">
      <div><span>Sexo</span>${p.sexo === 'M' ? 'Mujer' : 'Hombre'}</div>
      <div><span>CURP</span>${esc(p.curp || '—')}</div>
      <div><span>RFC</span>${esc(p.rfc || '—')}</div>
      <div><span>Teléfono</span>${esc(p.telefono || '—')}</div>
      ${p.cargo ? `<div><span>Cargo</span>${esc(p.cargo)}</div>` : ''}
      ${p.domicilio ? `<div><span>Domicilio</span>${esc(p.domicilio)}</div>` : ''}
      ${p.notas ? `<div class="ancho"><span>Notas</span>${esc(p.notas)}</div>` : ''}
    </div>

    <section class="panel">
      <h2>Documentos</h2>
      ${TIPOS_PERSONALES.map(t => renglonDocumento({ etiqueta: TIPOS_DOCUMENTO[t].nombre, campo: 'personaId', id, tipos: [t] })).join('')}
      ${documentosExtra(otros)}
      <button class="btn" data-otro>➕ Agregar otro documento</button>
    </section>

    <section class="panel">
      <h2>Parcelas de su propiedad</h2>
      ${parcelas.map(x => `<a class="renglon" href="#/parcela/${esc(x.id)}">${esc(describirParcela(x))}</a>`).join('') || '<p class="vacio">Ninguna.</p>'}
      <a class="btn" href="#/parcela/nueva?propietario=${esc(id)}">➕ Registrar parcela</a>
    </section>

    <section class="panel">
      <h2>Contratos donde participa</h2>
      ${contratos.map(c => {
        const papel = c.parceleroId === id ? 'Parcelero' : c.inversionistaId === id ? 'Inversionista' : 'Testigo';
        return `<a class="renglon" href="#/contrato/${esc(c.id)}"><span class="pastilla">${papel}</span> ${esc(describirContrato(c))}</a>`;
      }).join('') || '<p class="vacio">Ninguno.</p>'}
    </section>

    <section class="panel">
      <h2>Portafolios (como agricultor)</h2>
      ${portafolios.map(x => `<a class="renglon" href="#/portafolio/${esc(x.id)}">${esc(x.ciclo)}${x.titulo ? ' · ' + esc(x.titulo) : ''}</a>`).join('') || '<p class="vacio">Ninguno.</p>'}
      <a class="btn" href="#/portafolio/nuevo?agricultor=${esc(id)}">➕ Nuevo portafolio</a>
    </section>`;

  cont.querySelector('[data-editar]').onclick = async () => { if (await formularioPersona(p)) vistaPersona(cont, id); };
  cont.querySelector('[data-otro]').onclick = () => subirDocumento({ campo: 'personaId', id, tipos: ['OTRO'] });
  cont.querySelector('[data-borrar]').onclick = async () => {
    const usos = contratos.length + parcelas.length + portafolios.length;
    const texto = usos
      ? `${p.nombre} aparece en ${usos} parcela(s)/contrato(s)/portafolio(s). Si la borras, ahí quedará vacía. ¿Borrar de todos modos junto con sus documentos?`
      : `¿Borrar a ${p.nombre} y todos sus documentos?`;
    if (!await confirmar(texto, { si: 'Borrar', peligro: true })) return;
    for (const d of docs) await borrarDocumento(d.id);
    await borrar('personas', id);
    aviso('Persona borrada.');
    location.hash = '#/personas';
  };
}

