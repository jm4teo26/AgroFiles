// =====================================================================
// ui.js — Ventanas, avisos y mensajes reutilizables
// =====================================================================

import { esc } from './util.js';

/** Muestra un aviso corto abajo de la pantalla. */
export function aviso(texto, tipo = 'ok') {
  const el = document.createElement('div');
  el.className = `aviso aviso-${tipo}`;
  el.textContent = texto;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('visible'));
  setTimeout(() => { el.classList.remove('visible'); setTimeout(() => el.remove(), 400); }, tipo === 'error' ? 6000 : 3000);
}

/**
 * Abre una ventana (modal). Devuelve { el, cuerpo, cerrar }.
 * opciones.ancho: 'normal' | 'grande'
 */
export function abrirModal(titulo, html, opciones = {}) {
  const fondo = document.createElement('div');
  fondo.className = 'modal-fondo';
  fondo.innerHTML = `
    <div class="modal ${opciones.ancho === 'grande' ? 'modal-grande' : ''}" role="dialog" aria-modal="true">
      <div class="modal-cabeza">
        <h2>${esc(titulo)}</h2>
        <button type="button" class="btn-icono" data-cerrar aria-label="Cerrar">✕</button>
      </div>
      <div class="modal-cuerpo">${html}</div>
    </div>`;
  document.body.appendChild(fondo);
  document.body.classList.add('con-modal');
  let cerrado = false;
  const cerrar = (valor) => {
    if (cerrado) return;
    cerrado = true;
    fondo.remove();
    if (!document.querySelector('.modal-fondo')) document.body.classList.remove('con-modal');
    opciones.alCerrar?.(valor);
  };
  fondo.querySelector('[data-cerrar]').onclick = () => cerrar(null);
  fondo.addEventListener('keydown', e => { if (e.key === 'Escape') cerrar(null); });
  const primero = fondo.querySelector('input, select, textarea');
  if (primero && !opciones.sinFoco) setTimeout(() => primero.focus(), 50);
  return { el: fondo, cuerpo: fondo.querySelector('.modal-cuerpo'), cerrar };
}

/** Pregunta Sí/No. Devuelve una promesa con true/false. */
export function confirmar(texto, { si = 'Sí', no = 'Cancelar', peligro = false } = {}) {
  return new Promise((resolver) => {
    const m = abrirModal('Confirmar', `
      <p>${esc(texto)}</p>
      <div class="acciones">
        <button type="button" class="btn" data-no>${esc(no)}</button>
        <button type="button" class="btn ${peligro ? 'btn-peligro' : 'btn-primario'}" data-si>${esc(si)}</button>
      </div>`, { alCerrar: v => resolver(v === true), sinFoco: true });
    m.cuerpo.querySelector('[data-si]').onclick = () => m.cerrar(true);
    m.cuerpo.querySelector('[data-no]').onclick = () => m.cerrar(false);
  });
}

/** Pide un texto (o contraseña). Devuelve el texto o null si se cancela. */
export function pedirTexto(titulo, texto, { tipo = 'text', valor = '' } = {}) {
  return new Promise((resolver) => {
    const m = abrirModal(titulo, `
      <form>
        <p>${esc(texto)}</p>
        <label class="campo"><input type="${tipo}" name="valor" value="${esc(valor)}" autocomplete="off" required></label>
        <div class="acciones">
          <button type="button" class="btn" data-no>Cancelar</button>
          <button type="submit" class="btn btn-primario">Aceptar</button>
        </div>
      </form>`, { alCerrar: v => resolver(v ?? null) });
    const f = m.cuerpo.querySelector('form');
    f.onsubmit = (e) => { e.preventDefault(); m.cerrar(f.valor.value); };
    m.cuerpo.querySelector('[data-no]').onclick = () => m.cerrar(null);
  });
}

/** Pantalla de "trabajando..." mientras se hace algo lento. */
export async function conEspera(texto, tarea) {
  const el = document.createElement('div');
  el.className = 'espera';
  el.innerHTML = `<div class="espera-caja"><div class="girador"></div><p>${esc(texto)}</p></div>`;
  document.body.appendChild(el);
  try {
    return await tarea();
  } finally {
    el.remove();
  }
}

/** Lee los valores de un formulario como objeto. */
export function valoresFormulario(form) {
  const datos = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === 'checkbox') {
      if (form.querySelectorAll(`[name="${el.name}"]`).length > 1) {
        datos[el.name] = datos[el.name] || [];
        if (el.checked) datos[el.name].push(el.value);
      } else {
        datos[el.name] = el.checked;
      }
    } else if (el.type === 'radio') {
      if (el.checked) datos[el.name] = el.value;
    } else {
      datos[el.name] = el.value.trim();
    }
  }
  return datos;
}
