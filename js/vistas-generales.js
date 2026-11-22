// =====================================================================
// vistas-generales.js — Inicio (avisos), búsqueda y respaldo
// =====================================================================

import { TIPOS_DOCUMENTO } from './config.js';
import { estado, lista, crearRespaldo, restaurarRespaldo } from './almacen.js';
import { avisosDocumentos, buscarTodo, nombrePersona, resumenPortafolio, ETIQUETA_ESTADO } from './logica.js';
import { aviso, confirmar, conEspera, pedirTexto } from './ui.js';
import { esc, descargar, compartir, hoyISO, fechaCorta, tamano, diasEntre } from './util.js';

const claveUltimoRespaldo = () => `ultimo-respaldo:${estado.usuario.usuario}`;

function ultimoRespaldo() {
  try { return localStorage.getItem(claveUltimoRespaldo()); } catch { return null; }
}

export function vistaInicio(cont) {
  const avisos = avisosDocumentos();
  const ports = lista('portafolios');
  const incompletos = ports.map(p => ({ p, r: resumenPortafolio(p) })).filter(x => x.r.listos < x.r.total);
  const ultimo = ultimoRespaldo();
  const diasSinRespaldo = ultimo ? diasEntre(ultimo, hoyISO()) : null;
  const esIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const instalada = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;

  cont.innerHTML = `
    <h1>Hola, ${esc(estado.usuario.nombre || estado.usuario.usuario)}</h1>
    ${esIOS && !instalada ? `<div class="alerta alerta-mal"><strong>Importante en iPhone/iPad:</strong> toca
      <em>Compartir</em> ➜ <em>Agregar a pantalla de inicio</em> y abre la app desde ese ícono.
      Si solo la usas en Safari, iOS puede borrar los datos después de unos días sin usarla.</div>` : ''}
    ${(diasSinRespaldo === null || diasSinRespaldo > 7) && lista('personas').length ? `<div class="alerta">
      ${diasSinRespaldo === null ? 'Todavía no has hecho un respaldo.' : `Tu último respaldo fue hace ${diasSinRespaldo} días.`}
      Los datos solo viven en este dispositivo. <a href="#/respaldo">Hacer respaldo ahora</a></div>` : ''}

    <div class="accesos">
      <a class="acceso" href="#/portafolio/nuevo"><span>📁</span>Nuevo portafolio</a>
      <a class="acceso" href="#/contrato/nuevo"><span>📝</span>Nuevo contrato</a>
      <a class="acceso" href="#/personas"><span>👤</span>Personas <small>${lista('personas').length}</small></a>
      <a class="acceso" href="#/parcelas"><span>🌾</span>Parcelas <small>${lista('parcelas').length}</small></a>
    </div>

    <section class="panel">
      <h2>Documentos por renovar ${avisos.length ? `<span class="pastilla pastilla-mal">${avisos.length}</span>` : ''}</h2>
      ${avisos.map(a => `
        <a class="doc doc-${a.estado}" href="#/persona/${esc(a.doc.personaId)}">
          <span class="doc-icono">${ETIQUETA_ESTADO[a.estado]}</span>
          <div class="doc-info"><strong>${esc(TIPOS_DOCUMENTO[a.doc.tipo]?.nombre)} · ${esc(nombrePersona(a.doc.personaId))}</strong>
          <small>${esc(a.texto)}</small></div>
        </a>`).join('') || '<p class="vacio">Todo vigente. 👍</p>'}
    </section>

    <section class="panel">
      <h2>Portafolios incompletos</h2>
      ${incompletos.map(({ p, r }) => `
        <a class="renglon" href="#/portafolio/${esc(p.id)}">
          <span class="crece">${esc(nombrePersona(p.agricultorId))} · ${esc(p.ciclo)}</span>
          <span class="pastilla pastilla-mal">${r.listos}/${r.total}</span>
        </a>`).join('') || '<p class="vacio">Ninguno.</p>'}
    </section>`;
}

export function vistaBuscar(cont, _id, params) {
  const q = params.get('q') || '';
  const resultados = buscarTodo(q);
  const grupos = {};
  for (const r of resultados) (grupos[r.tipo] = grupos[r.tipo] || []).push(r);
  cont.innerHTML = `
    <h1>Buscar</h1>
    <form class="buscador-grande" data-buscar>
      <input type="search" name="q" value="${esc(q)}" placeholder="Nombre, CURP, RFC, ejido, ciclo, documento…" autofocus>
      <button class="btn btn-primario">Buscar</button>
    </form>
    ${q ? `<p class="ayuda">${resultados.length} resultado(s) para “${esc(q)}”.</p>` : ''}
    ${Object.entries(grupos).map(([tipo, rs]) => `
      <section class="panel"><h2>${esc(tipo)}s</h2>
        ${rs.map(r => `<a class="renglon" href="${esc(r.ruta)}"><span class="crece"><strong>${esc(r.titulo)}</strong><small>${esc(r.detalle)}</small></span></a>`).join('')}
      </section>`).join('')}`;
  cont.querySelector('[data-buscar]').onsubmit = (ev) => {
    ev.preventDefault();
    location.hash = `#/buscar?q=${encodeURIComponent(ev.target.q.value)}`;
  };
}

export async function vistaRespaldo(cont) {
  let uso = '';
  try {
    const e = await navigator.storage?.estimate?.();
    if (e) uso = `Espacio usado por la app en este dispositivo: ${tamano(e.usage || 0)}${e.quota ? ` de ${tamano(e.quota)} disponibles` : ''}.`;
  } catch { /* sin soporte */ }
  let persistente = null;
  try { persistente = await navigator.storage?.persisted?.(); } catch { /* sin soporte */ }
  const ultimo = ultimoRespaldo();

  cont.innerHTML = `
    <h1>Respaldo</h1>
    <section class="panel">
      <h2>Hacer respaldo</h2>
      <p>Genera <strong>un solo archivo cifrado</strong> con todas tus personas, parcelas, contratos, portafolios y documentos.
         Guárdalo en una USB, en Drive, en la computadora… Nadie puede abrirlo sin tu usuario y contraseña.</p>
      <p class="ayuda">${ultimo ? `Último respaldo: ${fechaCorta(ultimo)}.` : 'Todavía no has hecho un respaldo en este dispositivo.'} ${esc(uso)}
        ${persistente === false ? ' El navegador no garantizó que guardará los datos para siempre: haz respaldos seguido.' : ''}</p>
      <div class="botones-fila">
        <button class="btn btn-primario" data-respaldo="descargar">⬇️ Descargar respaldo</button>
        <button class="btn" data-respaldo="compartir">📤 Compartir / guardar en…</button>
      </div>
    </section>
    <section class="panel">
      <h2>Restaurar o pasar a otro dispositivo</h2>
      <p>Abre aquí un archivo de respaldo. Sirve para recuperar tus datos o para pasarlos de la computadora al celular (o al revés).
         Debes estar dentro con el mismo usuario.</p>
      <div class="opciones">
        <label><input type="radio" name="modo" value="combinar" checked> <strong>Combinar</strong>: agrega lo del respaldo y conserva lo más reciente.</label>
        <label><input type="radio" name="modo" value="reemplazar"> <strong>Reemplazar</strong>: borra lo de este dispositivo y deja solo lo del respaldo.</label>
      </div>
      <label class="btn">📂 Elegir archivo de respaldo<input type="file" accept=".json,application/json" data-restaurar hidden></label>
    </section>`;

  const hacer = async (modo) => {
    const blob = await conEspera('Preparando respaldo…', crearRespaldo);
    const nombre = `respaldo-portafolios-${estado.usuario.usuario}-${hoyISO()}.json`;
    if (modo === 'compartir') { if (!await compartir(blob, nombre)) descargar(blob, nombre); }
    else descargar(blob, nombre);
    try { localStorage.setItem(claveUltimoRespaldo(), hoyISO()); } catch { /* sin soporte */ }
    aviso(`Respaldo listo (${tamano(blob.size)}).`);
  };
  cont.querySelectorAll('[data-respaldo]').forEach(b => { b.onclick = () => hacer(b.dataset.respaldo); });

  const input = cont.querySelector('[data-restaurar]');
  input.onchange = async () => {
    const archivo = input.files[0];
    input.value = '';
    if (!archivo) return;
    const modo = cont.querySelector('[name="modo"]:checked').value;
    if (modo === 'reemplazar' && !await confirmar('Se borrará TODO lo de este dispositivo para este usuario y quedará solo lo del respaldo. ¿Continuar?', { si: 'Reemplazar', peligro: true })) return;
    try {
      const texto = await archivo.text();
      const r = await restaurarRespaldo(texto, modo, (msg) => pedirTexto('Contraseña del respaldo', msg, { tipo: 'password' }));
      if (!r) return;
      aviso(`Respaldo cargado: ${r.registros} registros y ${r.archivos} archivos.`);
      location.hash = '#/inicio';
    } catch (e) {
      aviso(e.message || 'No se pudo leer el respaldo.', 'error');
    }
  };
}
