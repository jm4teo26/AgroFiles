/* =========================================================================
   util.js — Funciones de apoyo: HTML, avisos, ventanas, fechas y
   reglas de vencimiento de documentos.
   ========================================================================= */
(function (global) {
  'use strict';

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- Avisos breves (abajo de la pantalla) ---------- */
  function aviso(msg, tipo) {
    const d = document.createElement('div');
    d.className = 'toast ' + (tipo || '');
    d.textContent = msg;
    document.body.appendChild(d);
    setTimeout(() => d.classList.add('ver'), 10);
    setTimeout(() => { d.classList.remove('ver'); setTimeout(() => d.remove(), 300); }, tipo === 'error' ? 6000 : 3000);
  }

  /* ---------- Ventana (modal) ---------- */
  function ventana(titulo, html, opciones) {
    opciones = opciones || {};
    const fondo = document.createElement('div');
    fondo.className = 'modal-fondo';
    fondo.innerHTML = `<div class="modal ${opciones.ancho ? 'ancho' : ''}">
      <div class="modal-titulo"><h3>${esc(titulo)}</h3><button type="button" class="cerrar" aria-label="Cerrar">✕</button></div>
      <div class="modal-cuerpo">${html}</div></div>`;
    document.body.appendChild(fondo);
    const cerrar = () => fondo.remove();
    fondo.querySelector('.cerrar').onclick = cerrar;
    fondo.addEventListener('mousedown', (e) => { if (e.target === fondo && !opciones.fijo) cerrar(); });
    const primero = fondo.querySelector('input,select,textarea');
    if (primero && !PDFs.esCelular()) setTimeout(() => primero.focus(), 50);
    return { el: fondo, cerrar };
  }

  // Pide una contraseña en una ventana (regresa el texto o null)
  function pedirContrasena(titulo, texto) {
    return new Promise((resolver) => {
      const v = ventana(titulo, `<form>
        <p>${esc(texto)}</p>
        <label>Contraseña<input type="password" name="p" required autocomplete="current-password"></label>
        <div class="fila fin"><button type="button" class="sec" data-c>Cancelar</button><button class="prim">Aceptar</button></div></form>`);
      v.el.querySelector('[data-c]').onclick = () => { v.cerrar(); resolver(null); };
      v.el.querySelector('.cerrar').onclick = () => { v.cerrar(); resolver(null); };
      v.el.querySelector('form').onsubmit = (e) => { e.preventDefault(); const p = e.target.p.value; v.cerrar(); resolver(p); };
    });
  }

  /* ---------- Fechas ---------- */
  const hoyISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const aFecha = (iso) => { const [a, m, d] = iso.split('-').map(Number); return new Date(a, m - 1, d); };
  const aISO = (f) => `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
  function sumarMeses(iso, meses) { const f = aFecha(iso); f.setMonth(f.getMonth() + meses); return aISO(f); }
  function sumarDias(iso, dias) { const f = aFecha(iso); f.setDate(f.getDate() + dias); return aISO(f); }
  const diasEntre = (desde, hasta) => Math.round((aFecha(hasta) - aFecha(desde)) / 86400000);
  function fechaCorta(iso) {
    if (!iso) return '';
    const f = aFecha(iso.slice(0, 10));
    return f.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  /* ---------- Tipos de documento y vencimientos ----------
     Para cambiar cuánto dura un documento, cambia "meses" o "dias" aquí. */
  const DOCS_PERSONA = {
    ACTA: { nombre: 'Acta de nacimiento' },
    CURP: { nombre: 'CURP' },
    INE: { nombre: 'INE', venceAnio: true },
    CSF: { nombre: 'Constancia de situación fiscal', meses: 3 },
    OPINION: { nombre: 'Opinión de cumplimiento (SAT)', dias: 30 }
  };
  const DOCS_PARCELA = {
    CERTIFICADO: { nombre: 'Certificado parcelario' },
    CARTA: { nombre: 'Carta notariada u otro documento de propiedad' }
  };
  const DIAS_AVISO = 15; // avisar cuando falten estos días o menos

  // Regresa {estado, texto, vence}. estado: ok | porvencer | vencido | sinfecha | falta
  function estadoDoc(tipo, doc) {
    if (!doc || !doc.archivoId) return { estado: 'falta', texto: 'Falta' };
    const info = DOCS_PERSONA[tipo] || {};
    let vence = null;
    if (info.venceAnio) {
      if (!doc.vigencia) return { estado: 'sinfecha', texto: 'Falta el año de vigencia' };
      vence = `${doc.vigencia}-12-31`;
    } else if (info.meses || info.dias) {
      if (!doc.fecha) return { estado: 'sinfecha', texto: 'Falta la fecha de emisión' };
      vence = info.meses ? sumarMeses(doc.fecha, info.meses) : sumarDias(doc.fecha, info.dias);
    } else {
      return { estado: 'ok', texto: 'Listo' };
    }
    const dias = diasEntre(hoyISO(), vence);
    if (dias < 0) return { estado: 'vencido', texto: `Vencido desde ${fechaCorta(vence)}`, vence };
    if (dias <= DIAS_AVISO) return { estado: 'porvencer', texto: `Vence en ${dias} día${dias === 1 ? '' : 's'} (${fechaCorta(vence)})`, vence };
    return { estado: 'ok', texto: `Vigente hasta ${fechaCorta(vence)}`, vence };
  }

  const ICONO = { ok: '✅', porvencer: '⚠️', vencido: '⛔', sinfecha: '⚠️', falta: '❌' };

  function tamano(bytes) {
    if (!bytes && bytes !== 0) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(0) + ' KB';
    if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
    return (bytes / 1073741824).toFixed(2) + ' GB';
  }

  // Quita acentos y pasa a minúsculas (para buscar)
  const normal = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  // Elige un archivo del dispositivo (PDF o foto). En celular deja tomar foto.
  function elegirArchivo(acepta) {
    return new Promise((resolver) => {
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = acepta || 'application/pdf,image/*';
      inp.style.display = 'none';
      document.body.appendChild(inp);
      inp.onchange = () => { resolver(inp.files[0] || null); inp.remove(); };
      inp.addEventListener('cancel', () => { resolver(null); inp.remove(); });
      inp.click();
    });
  }

  global.U = {
    $, $$, esc, aviso, ventana, pedirContrasena, hoyISO, sumarMeses, sumarDias, diasEntre, fechaCorta,
    DOCS_PERSONA, DOCS_PARCELA, estadoDoc, ICONO, tamano, normal, elegirArchivo
  };
})(window);
