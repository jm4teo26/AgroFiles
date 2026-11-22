/* =========================================================================
   app.js — Pantallas de la aplicación.

   Secciones:
     1. Entrar / salir
     2. Navegación
     3. Inicio (avisos)
     4. Personas
     5. Parcelas
     6. Contratos
     7. Portafolios
     8. Búsqueda
     9. Respaldo y ajustes
    10. Piezas compartidas (documentos, selectores)
   ========================================================================= */
(function () {
  'use strict';
  const { $, $$, esc, aviso, ventana } = U;
  const A = Almacen;
  const principal = () => $('#principal');

  /* =====================================================================
     1. ENTRAR / SALIR
     ===================================================================== */
  let usuarioConfig = null;
  let temporizador = null;
  const MINUTOS_INACTIVO = 20;

  function pantallaEntrar(mensaje) {
    document.body.classList.remove('con-sesion');
    $('#app').innerHTML = `
      <div class="entrar">
        <form class="tarjeta" id="formEntrar">
          <img src="icons/icono-192.png" alt="" width="72" height="72">
          <h1>Portafolios Agrícolas</h1>
          ${mensaje ? `<p class="error">${esc(mensaje)}</p>` : ''}
          <label>Usuario<input name="u" autocomplete="username" autocapitalize="none" required></label>
          <label>Contraseña<input name="p" type="password" autocomplete="current-password" required></label>
          <button class="prim grande">Entrar</button>
          <p class="ayuda">La información se guarda cifrada solo en este dispositivo.</p>
        </form>
      </div>`;
    $('#formEntrar').onsubmit = async (e) => {
      e.preventDefault();
      const boton = e.target.querySelector('button');
      const u = e.target.u.value.trim().toLowerCase();
      const p = e.target.p.value;
      const cfg = (window.USUARIOS || []).find((x) => x.usuario.toLowerCase() === u);
      boton.disabled = true; boton.textContent = 'Revisando…';
      try {
        if (!cfg || (await Cripto.calcularVerificador(p, cfg.sal)) !== cfg.verificador) {
          throw new Error('Usuario o contraseña incorrectos.');
        }
        await A.iniciar(cfg.usuario, p, cfg.sal);
        usuarioConfig = cfg;
        iniciarApp();
      } catch (err) {
        pantallaEntrar(err.message);
      }
    };
  }

  function salir(mensaje) {
    A.cerrar();
    usuarioConfig = null;
    clearTimeout(temporizador);
    location.hash = '';
    pantallaEntrar(mensaje);
  }

  function reiniciarTemporizador() {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => salir('Se cerró la sesión por inactividad.'), MINUTOS_INACTIVO * 60000);
  }

  /* =====================================================================
     2. NAVEGACIÓN
     ===================================================================== */
  const MENU = [
    ['inicio', '🏠', 'Inicio'], ['personas', '👤', 'Personas'], ['parcelas', '🌾', 'Parcelas'],
    ['contratos', '📝', 'Contratos'], ['portafolios', '📁', 'Portafolios'], ['respaldo', '💾', 'Respaldo']
  ];

  function iniciarApp() {
    document.body.classList.add('con-sesion');
    $('#app').innerHTML = `
      <header class="barra">
        <a href="#/inicio" class="marca">📁 <span>Portafolios</span></a>
        <form id="formBuscar" class="buscar"><input type="search" placeholder="Buscar en todo…" id="cajaBuscar"></form>
        <button class="sec chico" id="btnSalir" title="Cerrar sesión">Salir</button>
      </header>
      <nav class="menu">${MENU.map(([r, i, t]) => `<a href="#/${r}" data-r="${r}"><span>${i}</span>${t}</a>`).join('')}</nav>
      <main id="principal"></main>`;
    $('#btnSalir').onclick = () => salir();
    $('#formBuscar').onsubmit = (e) => { e.preventDefault(); location.hash = '#/buscar/' + encodeURIComponent($('#cajaBuscar').value); };
    ['click', 'keydown', 'touchstart'].forEach((ev) => document.addEventListener(ev, reiniciarTemporizador, { passive: true }));
    reiniciarTemporizador();
    if (!location.hash || location.hash === '#') location.hash = '#/inicio';
    else navegar();
  }

  window.addEventListener('hashchange', () => { if (A.usuario) navegar(); });

  async function navegar() {
    const partes = location.hash.replace(/^#\//, '').split('/');
    const ruta = partes[0] || 'inicio';
    const id = partes[1] ? decodeURIComponent(partes[1]) : null;
    $$('.menu a').forEach((a) => a.classList.toggle('activo', ruta.startsWith(a.dataset.r.replace(/s$/, ''))));
    window.scrollTo(0, 0);
    const vistas = {
      inicio: vistaInicio, personas: vistaPersonas, persona: vistaPersona, parcelas: vistaParcelas,
      parcela: vistaParcela, contratos: vistaContratos, contrato: vistaContrato,
      portafolios: vistaPortafolios, portafolio: vistaPortafolio, buscar: vistaBuscar, respaldo: vistaRespaldo
    };
    try {
      await (vistas[ruta] || vistaInicio)(id, partes);
    } catch (e) {
      console.error(e);
      principal().innerHTML = `<p class="error">Ocurrió un error: ${esc(e.message)}</p>`;
    }
  }
  const ir = (h) => { if (location.hash === h) navegar(); else location.hash = h; };

  /* ---------- Nombres para mostrar ---------- */
  const nombrePersona = (id) => { const p = A.obtener('persona', id); return p ? p.nombre : '—'; };
  function nombreParcela(id) {
    const p = A.obtener('parcela', id);
    if (!p) return '—';
    return `Parcela ${p.numero || 's/n'}${p.ejido ? ' · Ejido ' + p.ejido : ''}${p.hectareas ? ' · ' + p.hectareas + ' ha' : ''}`;
  }
  const porNombre = (a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es');

  /* =====================================================================
     3. INICIO
     ===================================================================== */
  function avisosDocumentos() {
    const lista = [];
    A.lista('persona').forEach((p) => {
      Object.keys(U.DOCS_PERSONA).forEach((t) => {
        const doc = (p.docs || {})[t];
        if (!doc || !doc.archivoId) return;
        const e = U.estadoDoc(t, doc);
        if (e.estado !== 'ok') lista.push({ p, t, e });
      });
    });
    const peso = { vencido: 0, porvencer: 1, sinfecha: 2 };
    return lista.sort((a, b) => peso[a.e.estado] - peso[b.e.estado]);
  }

  function vistaInicio() {
    const avisos = avisosDocumentos();
    const ultimo = localStorage.getItem('ultimoRespaldo__' + A.usuario);
    const diasResp = ultimo ? U.diasEntre(ultimo.slice(0, 10), U.hoyISO()) : null;
    const pfs = A.lista('portafolio').sort((a, b) => (b.actualizado || '').localeCompare(a.actualizado || '')).slice(0, 6);
    principal().innerHTML = `
      <h2>Hola, ${esc(usuarioConfig.nombre || usuarioConfig.usuario)}</h2>
      <div class="cifras">
        <a href="#/personas" class="cifra"><b>${A.lista('persona').length}</b>Personas</a>
        <a href="#/parcelas" class="cifra"><b>${A.lista('parcela').length}</b>Parcelas</a>
        <a href="#/contratos" class="cifra"><b>${A.lista('contrato').length}</b>Contratos</a>
        <a href="#/portafolios" class="cifra"><b>${A.lista('portafolio').length}</b>Portafolios</a>
      </div>
      ${diasResp === null || diasResp >= 7 ? `<div class="alerta amarilla">💾 ${diasResp === null ? 'Aún no has hecho ningún respaldo.' : `Tu último respaldo fue hace ${diasResp} días.`}
        Si se pierde o se borra el navegador, la información se pierde. <a href="#/respaldo">Hacer respaldo</a></div>` : ''}
      <section class="tarjeta">
        <h3>Documentos que hay que renovar</h3>
        ${avisos.length ? `<ul class="lista">${avisos.map(({ p, t, e }) => `
          <li><a href="#/persona/${p.id}"><span>${U.ICONO[e.estado]}</span>
          <div><b>${esc(p.nombre)}</b><small>${esc(U.DOCS_PERSONA[t].nombre)}: ${esc(e.texto)}</small></div></a></li>`).join('')}</ul>`
          : '<p class="vacio">Todo en orden. No hay documentos vencidos ni por vencer.</p>'}
      </section>
      <section class="tarjeta">
        <div class="fila entre"><h3>Portafolios recientes</h3><a href="#/portafolios" class="boton sec chico">Ver todos</a></div>
        ${pfs.length ? `<ul class="lista">${pfs.map((pf) => htmlFilaPortafolio(pf)).join('')}</ul>` : '<p class="vacio">Aún no hay portafolios.</p>'}
      </section>`;
  }

  /* =====================================================================
     4. PERSONAS
     ===================================================================== */
  function vistaPersonas() {
    const personas = A.lista('persona').sort(porNombre);
    principal().innerHTML = `
      <div class="fila entre"><h2>Personas</h2><button class="prim" id="nueva">+ Nueva persona</button></div>
      <p class="ayuda">Agricultores, parceleros (dueños de tierra) y testigos. Registra a cada persona una vez con sus documentos y se usarán automáticamente en contratos y portafolios.</p>
      <input type="search" class="filtro" placeholder="Filtrar por nombre, CURP o RFC…">
      <ul class="lista" id="lista">${personas.map((p) => {
        const faltan = Object.keys(U.DOCS_PERSONA).filter((t) => U.estadoDoc(t, (p.docs || {})[t]).estado !== 'ok');
        return `<li data-texto="${esc(U.normal(p.nombre + ' ' + (p.curp || '') + ' ' + (p.rfc || '') + ' ' + (p.cargo || '')))}">
          <a href="#/persona/${p.id}"><span>👤</span><div><b>${esc(p.nombre)}</b>
          <small>${esc([p.cargo, p.curp].filter(Boolean).join(' · '))}${faltan.length ? ` · <span class="rojo">${faltan.length} documento${faltan.length > 1 ? 's' : ''} pendiente${faltan.length > 1 ? 's' : ''}</span>` : ' · <span class="verde">documentos completos</span>'}</small></div></a></li>`;
      }).join('') || '<p class="vacio">Aún no hay personas registradas.</p>'}</ul>`;
    $('#nueva').onclick = () => ir('#/persona/nueva');
    conectarFiltro();
  }

  function conectarFiltro() {
    const f = $('.filtro');
    if (!f) return;
    f.oninput = () => {
      const q = U.normal(f.value);
      $$('#lista li').forEach((li) => { li.style.display = !q || (li.dataset.texto || '').includes(q) ? '' : 'none'; });
    };
  }

  async function vistaPersona(id) {
    const nueva = id === 'nueva';
    const p = nueva ? { nombre: '', sexo: 'H', docs: {} } : A.obtener('persona', id);
    if (!p) { principal().innerHTML = '<p>No se encontró la persona.</p>'; return; }
    p.docs = p.docs || {};
    const parcelas = nueva ? [] : A.lista('parcela').filter((x) => x.propietarioId === p.id);
    const pfs = nueva ? [] : A.lista('portafolio').filter((x) => x.agricultorId === p.id);
    principal().innerHTML = `
      <a href="#/personas" class="volver">← Personas</a>
      <h2>${nueva ? 'Nueva persona' : esc(p.nombre)}</h2>
      <form class="tarjeta" id="formPersona">
        <div class="rejilla">
          <label class="doble">Nombre completo (como va en el contrato: APELLIDOS NOMBRES)
            <input name="nombre" value="${esc(p.nombre)}" required placeholder="RUELAS FLORES MARCO ANTONIO"></label>
          <label>Sexo<select name="sexo"><option value="H" ${p.sexo !== 'M' ? 'selected' : ''}>Hombre (EL SEÑOR)</option><option value="M" ${p.sexo === 'M' ? 'selected' : ''}>Mujer (LA SEÑORA)</option></select></label>
          <label>Cargo o papel (opcional)<input name="cargo" value="${esc(p.cargo)}" placeholder="Ej. Comisariado ejidal, Síndico"></label>
          <label>CURP<input name="curp" value="${esc(p.curp)}" maxlength="18" class="mayus"></label>
          <label>RFC<input name="rfc" value="${esc(p.rfc)}" maxlength="13" class="mayus"></label>
          <label>Teléfono<input name="telefono" type="tel" value="${esc(p.telefono)}"></label>
          <label>Domicilio / Ejido<input name="domicilio" value="${esc(p.domicilio)}"></label>
          <label class="doble">Notas<textarea name="notas" rows="2">${esc(p.notas)}</textarea></label>
        </div>
        <div class="fila fin">
          ${nueva ? '' : '<button type="button" class="peligro" id="borrar">Eliminar persona</button>'}
          <button class="prim">${nueva ? 'Guardar y subir documentos' : 'Guardar cambios'}</button>
        </div>
      </form>
      ${nueva ? '' : `
      <section class="tarjeta">
        <h3>Documentos</h3>
        <p class="ayuda">Para la constancia y la opinión del SAT pon la fecha de emisión; para la INE, el año de vigencia. Así la app te avisa cuando haya que renovarlos.</p>
        <div id="docs">${Object.keys(U.DOCS_PERSONA).map((t) => htmlSlot(t, U.DOCS_PERSONA[t].nombre, p.docs[t], t)).join('')}</div>
      </section>
      <section class="tarjeta">
        <div class="fila entre"><h3>Parcelas de las que es dueño</h3><a class="boton sec chico" href="#/parcela/nueva?dueno=${p.id}">+ Agregar parcela</a></div>
        ${parcelas.length ? `<ul class="lista">${parcelas.map((x) => `<li><a href="#/parcela/${x.id}"><span>🌾</span><div><b>${esc(nombreParcela(x.id))}</b></div></a></li>`).join('')}</ul>` : '<p class="vacio">Ninguna.</p>'}
      </section>
      <section class="tarjeta">
        <h3>Portafolios como agricultor</h3>
        ${pfs.length ? `<ul class="lista">${pfs.map(htmlFilaPortafolio).join('')}</ul>` : '<p class="vacio">Ninguno.</p>'}
      </section>`}`;

    $('#formPersona').onsubmit = async (e) => {
      e.preventDefault();
      const f = e.target;
      Object.assign(p, {
        nombre: f.nombre.value.trim().toUpperCase(), sexo: f.sexo.value, cargo: f.cargo.value.trim(),
        curp: f.curp.value.trim().toUpperCase(), rfc: f.rfc.value.trim().toUpperCase(),
        telefono: f.telefono.value.trim(), domicilio: f.domicilio.value.trim(), notas: f.notas.value.trim()
      });
      const dup = A.lista('persona').find((x) => x.id !== p.id && ((p.curp && x.curp === p.curp) || x.nombre === p.nombre));
      if (dup && !confirm(`Ya existe "${dup.nombre}"${dup.curp ? ' (' + dup.curp + ')' : ''}. ¿Guardar de todos modos?`)) return;
      await A.guardar('persona', p);
      aviso('Guardado');
      if (nueva) ir('#/persona/' + p.id); else vistaPersona(p.id);
    };
    if (nueva) return;
    $('#borrar').onclick = async () => {
      const usos = A.lista('contrato').filter((c) => [c.parceleroId, c.inversionistaId, c.testigo1Id, c.testigo2Id].includes(p.id)).length + pfs.length + parcelas.length;
      if (!confirm(`¿Eliminar a ${p.nombre} y todos sus documentos?${usos ? `\n\nOjo: aparece en ${usos} contrato(s), parcela(s) o portafolio(s).` : ''}`)) return;
      for (const t of Object.keys(p.docs)) await A.eliminarArchivo(p.docs[t] && p.docs[t].archivoId);
      await A.eliminar('persona', p.id);
      aviso('Persona eliminada');
      ir('#/personas');
    };
    conectarSlots($('#docs'), {
      obtener: (clave) => p.docs[clave],
      guardar: async (clave, doc) => { if (doc) p.docs[clave] = doc; else delete p.docs[clave]; await A.guardar('persona', p); },
      refrescar: () => vistaPersona(p.id),
      nombreArchivo: (clave) => `${U.DOCS_PERSONA[clave].nombre} - ${p.nombre}`
    });
  }

  /* =====================================================================
     5. PARCELAS
     ===================================================================== */
  function vistaParcelas() {
    const parcelas = A.lista('parcela').sort((a, b) => nombrePersona(a.propietarioId).localeCompare(nombrePersona(b.propietarioId), 'es'));
    principal().innerHTML = `
      <div class="fila entre"><h2>Parcelas</h2><a class="boton prim" href="#/parcela/nueva">+ Nueva parcela</a></div>
      <input type="search" class="filtro" placeholder="Filtrar por dueño, número o ejido…">
      <ul class="lista" id="lista">${parcelas.map((x) => {
        const tieneDoc = (x.docs || {}).CERTIFICADO || (x.docs || {}).CARTA;
        return `<li data-texto="${esc(U.normal(nombrePersona(x.propietarioId) + ' ' + nombreParcela(x.id) + ' ' + (x.certificado || '')))}">
        <a href="#/parcela/${x.id}"><span>🌾</span><div><b>${esc(nombreParcela(x.id))}</b>
        <small>Dueño: ${esc(nombrePersona(x.propietarioId))} · ${tieneDoc ? '<span class="verde">con documento de propiedad</span>' : '<span class="rojo">falta certificado</span>'}</small></div></a></li>`;
      }).join('') || '<p class="vacio">Aún no hay parcelas.</p>'}</ul>`;
    conectarFiltro();
  }

  async function vistaParcela(id) {
    const nueva = id && id.startsWith('nueva');
    const duenoInicial = (location.hash.match(/dueno=([^&]+)/) || [])[1] || '';
    const x = nueva ? { propietarioId: duenoInicial, estado: 'SINALOA', colindancias: {}, docs: {} } : A.obtener('parcela', id);
    if (!x) { principal().innerHTML = '<p>No se encontró la parcela.</p>'; return; }
    x.docs = x.docs || {}; x.colindancias = x.colindancias || {};
    principal().innerHTML = `
      <a href="#/parcelas" class="volver">← Parcelas</a>
      <h2>${nueva ? 'Nueva parcela' : esc(nombreParcela(x.id))}</h2>
      <form class="tarjeta" id="formParcela">
        <div class="rejilla">
          <label class="doble">Dueño (parcelero)${htmlSelectPersona('propietarioId', x.propietarioId, true)}</label>
          <label>Número de parcela<input name="numero" value="${esc(x.numero)}"></label>
          <label>Número de certificado parcelario<input name="certificado" value="${esc(x.certificado)}"></label>
          <label>Superficie (hectáreas)<input name="hectareas" value="${esc(x.hectareas)}" inputmode="decimal" placeholder="6.05"></label>
          <label>Ejido<input name="ejido" value="${esc(x.ejido)}" class="mayus" placeholder="LA BRECHA"></label>
          <label>Municipio<input name="municipio" value="${esc(x.municipio)}" class="mayus" placeholder="GUASAVE"></label>
          <label>Estado<input name="estado" value="${esc(x.estado)}" class="mayus"></label>
        </div>
        <h4>Colindancias</h4>
        <div class="rejilla">
          ${['norte', 'sur', 'este', 'oeste'].map((c) => `<label>Al ${c}<input name="col_${c}" value="${esc(x.colindancias[c])}" class="mayus" placeholder="Ej. MIGUEL ACOSTA o CON PARCELA 94 386.28 MTS"></label>`).join('')}
        </div>
        <div class="fila fin">
          ${nueva ? '' : '<button type="button" class="peligro" id="borrar">Eliminar parcela</button>'}
          <button class="prim">${nueva ? 'Guardar y subir documentos' : 'Guardar cambios'}</button>
        </div>
      </form>
      ${nueva ? '' : `<section class="tarjeta"><h3>Documento de propiedad</h3>
        <p class="ayuda">Sube el certificado parcelario. Si el dueño no lo tiene, sube la carta notariada u otro documento que lo acredite como propietario.</p>
        <div id="docs">${Object.keys(U.DOCS_PARCELA).map((t) => htmlSlot(t, U.DOCS_PARCELA[t].nombre, x.docs[t], null)).join('')}</div></section>`}`;
    conectarSelectPersona(principal());
    $('#formParcela').onsubmit = async (e) => {
      e.preventDefault();
      const f = e.target;
      if (!f.propietarioId.value) { aviso('Elige al dueño de la parcela', 'error'); return; }
      Object.assign(x, {
        propietarioId: f.propietarioId.value, numero: f.numero.value.trim(), certificado: f.certificado.value.trim(),
        hectareas: f.hectareas.value.trim(), ejido: f.ejido.value.trim().toUpperCase(),
        municipio: f.municipio.value.trim().toUpperCase(), estado: f.estado.value.trim().toUpperCase(),
        colindancias: { norte: f.col_norte.value.trim(), sur: f.col_sur.value.trim(), este: f.col_este.value.trim(), oeste: f.col_oeste.value.trim() }
      });
      await A.guardar('parcela', x);
      aviso('Guardado');
      if (nueva) ir('#/parcela/' + x.id); else vistaParcela(x.id);
    };
    if (nueva) return;
    $('#borrar').onclick = async () => {
      if (!confirm('¿Eliminar esta parcela y su documento de propiedad?')) return;
      for (const t of Object.keys(x.docs)) await A.eliminarArchivo(x.docs[t] && x.docs[t].archivoId);
      await A.eliminar('parcela', x.id);
      ir('#/parcelas');
    };
    conectarSlots($('#docs'), {
      obtener: (c) => x.docs[c],
      guardar: async (c, doc) => { if (doc) x.docs[c] = doc; else delete x.docs[c]; await A.guardar('parcela', x); },
      refrescar: () => vistaParcela(x.id),
      nombreArchivo: (c) => `${U.DOCS_PARCELA[c].nombre} - ${nombrePersona(x.propietarioId)}`
    });
  }

  /* =====================================================================
     6. CONTRATOS
     ===================================================================== */
  function tituloContrato(c) {
    return `${nombrePersona(c.parceleroId)} → ${nombrePersona(c.inversionistaId)}`;
  }

  function vistaContratos() {
    const cs = A.lista('contrato').sort((a, b) => (b.actualizado || '').localeCompare(a.actualizado || ''));
    principal().innerHTML = `
      <div class="fila entre"><h2>Contratos de arrendamiento</h2><a class="boton prim" href="#/contrato/nuevo">+ Nuevo contrato</a></div>
      <input type="search" class="filtro" placeholder="Filtrar…">
      <ul class="lista" id="lista">${cs.map((c) => `
        <li data-texto="${esc(U.normal(tituloContrato(c) + ' ' + (c.ciclo || '') + ' ' + (c.ejido || '')))}"><a href="#/contrato/${c.id}"><span>📝</span><div>
        <b>${esc(tituloContrato(c))}</b><small>Ciclo ${esc(c.ciclo || '—')} · ${esc(c.hectareas || '')} ha · ${c.firmadoId ? '<span class="verde">firmado y escaneado</span>' : '<span class="rojo">falta subir el contrato firmado</span>'}</small></div></a></li>`).join('')
        || '<p class="vacio">Aún no hay contratos.</p>'}</ul>`;
    conectarFiltro();
  }

  // Crea un contrato con datos tomados de la parcela y del portafolio
  function contratoInicial(parcelaId, inversionistaId, ciclo) {
    const x = A.obtener('parcela', parcelaId) || { colindancias: {} };
    return {
      parcelaId: parcelaId || '', parceleroId: x.propietarioId || '', inversionistaId: inversionistaId || '',
      testigo1Id: '', testigo2Id: '', hectareas: x.hectareas || '', ejido: x.ejido || '', ciclo: ciclo || '',
      cultivo: 'MAÍZ', monto: '', colindancias: Object.assign({}, x.colindancias), duracionAnios: '',
      fechaInicio: '', fechaFin: '', lugarEjido: x.ejido || '', municipio: x.municipio || '', estado: x.estado || 'SINALOA',
      fechaFirma: ''
    };
  }

  async function vistaContrato(id) {
    const nuevo = id === 'nuevo';
    const c = nuevo ? contratoInicial() : A.obtener('contrato', id);
    if (!c) { principal().innerHTML = '<p>No se encontró el contrato.</p>'; return; }
    const pf = c.portafolioId ? A.obtener('portafolio', c.portafolioId) : null;
    c.colindancias = c.colindancias || {};
    principal().innerHTML = `
      ${pf ? `<a href="#/portafolio/${pf.id}" class="volver">← Portafolio de ${esc(nombrePersona(pf.agricultorId))}</a>` : '<a href="#/contratos" class="volver">← Contratos</a>'}
      <h2>${nuevo ? 'Nuevo contrato' : 'Contrato: ' + esc(tituloContrato(c))}</h2>
      <form class="tarjeta" id="formContrato">
        <h4>Personas que firman</h4>
        <div class="rejilla">
          <label>Parcelero (dueño de la tierra)${htmlSelectPersona('parceleroId', c.parceleroId, true)}</label>
          <label>Inversionista (el agricultor que siembra)${htmlSelectPersona('inversionistaId', c.inversionistaId, true)}</label>
          <label>Testigo 1${htmlSelectPersona('testigo1Id', c.testigo1Id)}</label>
          <label>Testigo 2 (síndico, comisariado…)${htmlSelectPersona('testigo2Id', c.testigo2Id)}</label>
        </div>
        <h4>Parcela</h4>
        <div class="rejilla">
          <label class="doble">Parcela registrada (llena los datos de abajo)${htmlSelectParcela('parcelaId', c.parcelaId)}</label>
          <label>Hectáreas<input name="hectareas" value="${esc(c.hectareas)}" inputmode="decimal" required></label>
          <label>Ejido<input name="ejido" value="${esc(c.ejido)}" class="mayus" required></label>
          ${['norte', 'sur', 'este', 'oeste'].map((k) => `<label>Al ${k}<input name="col_${k}" value="${esc(c.colindancias[k])}" class="mayus" required></label>`).join('')}
        </div>
        <h4>Condiciones</h4>
        <div class="rejilla">
          <label>Ciclo<input name="ciclo" value="${esc(c.ciclo)}" class="mayus" placeholder="O-I 2026 - 2029" required></label>
          <label>Cultivo<input name="cultivo" value="${esc(c.cultivo)}" class="mayus" required></label>
          <label>Renta (pesos)<input name="monto" value="${esc(c.monto)}" inputmode="decimal" required placeholder="180000"></label>
          <label>Con letra<input name="letra" readonly tabindex="-1" class="solo-lectura"></label>
          <label>Fecha de inicio<input name="fechaInicio" type="date" value="${esc(c.fechaInicio)}" required></label>
          <label>Duración (años)<input name="duracionAnios" type="number" min="1" max="30" value="${esc(c.duracionAnios)}" required></label>
          <label>Fecha de terminación<input name="fechaFin" type="date" value="${esc(c.fechaFin)}" required></label>
        </div>
        <h4>Lugar y fecha de firma</h4>
        <div class="rejilla">
          <label>Ejido<input name="lugarEjido" value="${esc(c.lugarEjido)}" class="mayus" required></label>
          <label>Municipio<input name="municipio" value="${esc(c.municipio)}" class="mayus" required></label>
          <label>Estado<input name="estado" value="${esc(c.estado)}" class="mayus" required></label>
          <label>Fecha de firma<input name="fechaFirma" type="date" value="${esc(c.fechaFirma)}" required></label>
        </div>
        <div class="fila fin">
          ${nuevo || pf ? '' : '<button type="button" class="peligro" id="borrar">Eliminar contrato</button>'}
          <button type="submit" class="sec" name="accion" value="guardar">Guardar</button>
          <button type="submit" class="prim" name="accion" value="pdf">Guardar y crear PDF</button>
        </div>
      </form>
      ${nuevo ? '' : `<section class="tarjeta">
        <h3>Archivos del contrato</h3>
        <div class="slot"><div class="slot-info"><b>Contrato para imprimir (PDF)</b>
          <small>${c.generadoId ? 'Creado ' + U.fechaCorta(c.generadoFecha) : 'Aún no se crea. Llena los datos y presiona «Guardar y crear PDF».'}</small></div>
          ${c.generadoId ? `<div class="slot-botones"><button class="sec chico" data-gen="ver">Ver / imprimir</button><button class="sec chico" data-gen="guardar">Guardar en el dispositivo</button></div>` : ''}</div>
        <div id="docsContrato">${htmlSlot('FIRMADO', 'Contrato firmado (escaneado o foto)', c.firmadoId ? { archivoId: c.firmadoId, subido: c.firmadoFecha } : null, null)}</div>
        <h4>Anexos que se toman automáticamente</h4>
        <ul class="lista compacta">${anexosContrato(c).map((a) => `<li><span>${U.ICONO[a.estado.estado]}</span><div><b>${esc(a.titulo)}</b><small>${esc(a.estado.texto)}</small></div></li>`).join('')}</ul>
      </section>`}`;

    const f = $('#formContrato');
    conectarSelectPersona(f);
    conectarSelectParcela(f);
    const actualizarLetra = () => {
      const n = Number(String(f.monto.value).replace(/[$,\s]/g, ''));
      f.letra.value = n > 0 ? Numeros.formatoMoneda(n) + ' = ' + Numeros.cantidadConLetra(n) : '';
    };
    const calcularFin = () => {
      if (f.fechaInicio.value && f.duracionAnios.value) f.fechaFin.value = U.sumarMeses(f.fechaInicio.value, 12 * Number(f.duracionAnios.value));
    };
    f.monto.oninput = actualizarLetra;
    f.fechaInicio.onchange = () => { calcularFin(); if (!f.fechaFirma.value) f.fechaFirma.value = f.fechaInicio.value; };
    f.duracionAnios.oninput = calcularFin;
    actualizarLetra();
    f.parcelaId.addEventListener('change', () => {
      const x = A.obtener('parcela', f.parcelaId.value);
      if (!x) return;
      if (x.propietarioId) f.parceleroId.value = x.propietarioId;
      f.hectareas.value = x.hectareas || ''; f.ejido.value = x.ejido || '';
      ['norte', 'sur', 'este', 'oeste'].forEach((k) => { f['col_' + k].value = (x.colindancias || {})[k] || ''; });
      f.lugarEjido.value = f.lugarEjido.value || x.ejido || '';
      f.municipio.value = f.municipio.value || x.municipio || '';
      f.estado.value = x.estado || f.estado.value;
    });

    f.onsubmit = async (e) => {
      e.preventDefault();
      const accion = e.submitter ? e.submitter.value : 'guardar';
      const monto = Number(String(f.monto.value).replace(/[$,\s]/g, ''));
      if (!(monto > 0)) { aviso('Escribe la renta con números, por ejemplo 180000', 'error'); return; }
      if (f.testigo1Id.value && f.testigo1Id.value === f.testigo2Id.value) { aviso('Los dos testigos son la misma persona', 'error'); return; }
      Object.assign(c, {
        parceleroId: f.parceleroId.value, inversionistaId: f.inversionistaId.value, testigo1Id: f.testigo1Id.value,
        testigo2Id: f.testigo2Id.value, parcelaId: f.parcelaId.value, hectareas: f.hectareas.value.trim(),
        ejido: f.ejido.value.trim().toUpperCase(), ciclo: f.ciclo.value.trim().toUpperCase(), cultivo: f.cultivo.value.trim().toUpperCase(),
        monto, colindancias: { norte: f.col_norte.value.trim(), sur: f.col_sur.value.trim(), este: f.col_este.value.trim(), oeste: f.col_oeste.value.trim() },
        duracionAnios: Number(f.duracionAnios.value), fechaInicio: f.fechaInicio.value, fechaFin: f.fechaFin.value,
        lugarEjido: f.lugarEjido.value.trim().toUpperCase(), municipio: f.municipio.value.trim().toUpperCase(),
        estado: f.estado.value.trim().toUpperCase(), fechaFirma: f.fechaFirma.value
      });
      await A.guardar('contrato', c);
      if (accion === 'pdf') {
        try {
          const bytes = await crearPDFContrato(c);
          await A.eliminarArchivo(c.generadoId);
          const arch = await A.guardarArchivo(bytes, `CONTRATO - ${nombrePersona(c.parceleroId)}.pdf`, 'application/pdf');
          c.generadoId = arch.id; c.generadoFecha = new Date().toISOString();
          await A.guardar('contrato', c);
          aviso('Contrato creado');
          if (nuevo) location.hash = '#/contrato/' + c.id; else await vistaContrato(c.id);
          ventanaContratoListo(c, bytes);
          return;
        } catch (err) { console.error(err); aviso('No se pudo crear el PDF: ' + err.message, 'error'); }
      } else aviso('Guardado');
      if (nuevo) ir('#/contrato/' + c.id); else vistaContrato(c.id);
    };
    if (nuevo) return;
    const btnBorrar = $('#borrar');
    if (btnBorrar) btnBorrar.onclick = async () => {
      if (!confirm('¿Eliminar este contrato y sus archivos?')) return;
      await A.eliminarArchivo(c.generadoId); await A.eliminarArchivo(c.firmadoId);
      await A.eliminar('contrato', c.id);
      ir('#/contratos');
    };
    $$('[data-gen]').forEach((b) => b.onclick = async () => {
      const a = await A.leerArchivo(c.generadoId);
      if (b.dataset.gen === 'ver') PDFs.abrirParaImprimir(a.bytes, a.mime);
      else PDFs.guardarEnDispositivo(a.bytes, a.nombre, a.mime);
    });
    conectarSlots($('#docsContrato'), {
      obtener: () => (c.firmadoId ? { archivoId: c.firmadoId, subido: c.firmadoFecha } : null),
      guardar: async (_, doc) => { c.firmadoId = doc ? doc.archivoId : null; c.firmadoFecha = doc ? doc.subido : null; await A.guardar('contrato', c); },
      refrescar: () => vistaContrato(c.id),
      nombreArchivo: () => `CONTRATO FIRMADO - ${nombrePersona(c.parceleroId)}`
    });
  }

  function ventanaContratoListo(c, bytes) {
    const nombre = `CONTRATO - ${nombrePersona(c.parceleroId)}.pdf`;
    const v = ventana('Contrato listo', `<p>El contrato se creó y quedó guardado en la app.</p>
      <div class="columna"><button class="prim grande" data-x="ver">🖨️ Ver / imprimir</button>
      <button class="sec grande" data-x="guardar">💾 Guardar en el dispositivo</button></div>`);
    v.el.querySelector('[data-x=ver]').onclick = () => PDFs.abrirParaImprimir(bytes);
    v.el.querySelector('[data-x=guardar]').onclick = () => PDFs.guardarEnDispositivo(bytes, nombre, 'application/pdf');
  }

  // Carga la letra del contrato y fontkit (solo la primera vez)
  let fuentesContrato = null;
  async function crearPDFContrato(c) {
    if (!fuentesContrato) {
      if (!window.fontkit) {
        await new Promise((res, rej) => {
          const s = document.createElement('script');
          s.src = 'lib/fontkit.umd.min.js'; s.onload = res; s.onerror = () => rej(new Error('No se pudo cargar fontkit'));
          document.head.appendChild(s);
        });
      }
      const [n, b] = await Promise.all(['fonts/LiberationSerif-Regular.ttf', 'fonts/LiberationSerif-Bold.ttf']
        .map((u) => fetch(u).then((r) => { if (!r.ok) throw new Error('No se encontró ' + u); return r.arrayBuffer(); })));
      fuentesContrato = { fontkit: window.fontkit, normal: n, negrita: b };
    }
    const parcelero = A.obtener('persona', c.parceleroId);
    const datos = Object.assign({}, c, {
      parceleroNombre: nombrePersona(c.parceleroId), parceleroSexo: parcelero ? parcelero.sexo : 'H',
      inversionistaNombre: nombrePersona(c.inversionistaId)
    });
    return Contrato.generarContratoPDF(datos, window.PDFLib, fuentesContrato);
  }

  // Documentos que acompañan al contrato (4 INE + documento de propiedad)
  function anexosContrato(c) {
    const ine = (pid, rol) => {
      const p = A.obtener('persona', pid);
      const doc = p && (p.docs || {}).INE;
      const est = !p ? { estado: 'falta', texto: 'No se ha elegido a la persona' } : U.estadoDoc('INE', doc);
      return { titulo: `INE ${rol}${p ? ' — ' + p.nombre : ''}`, archivoId: doc && doc.archivoId, estado: est, ir: p ? '#/persona/' + p.id : null };
    };
    const x = A.obtener('parcela', c.parcelaId);
    const docProp = x && ((x.docs || {}).CERTIFICADO || (x.docs || {}).CARTA);
    return {
      INE_PARCELERO: ine(c.parceleroId, 'del parcelero'),
      INE_INVERSIONISTA: ine(c.inversionistaId, 'del inversionista'),
      INE_T1: ine(c.testigo1Id, 'del testigo 1'),
      INE_T2: ine(c.testigo2Id, 'del testigo 2'),
      CERT: {
        titulo: `Certificado parcelario / documento de propiedad del dueño${x ? ' — ' + nombrePersona(x.propietarioId) : ''}`,
        archivoId: docProp && docProp.archivoId,
        estado: !x ? { estado: 'falta', texto: 'El contrato no tiene una parcela registrada elegida' } : docProp ? { estado: 'ok', texto: 'Listo' } : { estado: 'falta', texto: 'Falta subirlo en la parcela' },
        ir: x ? '#/parcela/' + x.id : null
      },
      toArray() { return [this.INE_PARCELERO, this.INE_INVERSIONISTA, this.INE_T1, this.INE_T2, this.CERT]; }
    }.toArray();
  }

  /* =====================================================================
     7. PORTAFOLIOS
     ===================================================================== */
  const PIEZAS_RENTA = {
    CONTRATO: 'Contrato firmado', INE_PARCELERO: 'INE del parcelero', INE_INVERSIONISTA: 'INE del inversionista (agricultor)',
    INE_T1: 'INE del testigo 1', INE_T2: 'INE del testigo 2', CERT: 'Certificado parcelario del dueño (o carta notariada)'
  };

  function htmlFilaPortafolio(pf) {
    const items = itemsPortafolio(pf).filter((i) => !(pf.excluidos || []).includes(i.clave));
    const listos = items.filter((i) => i.estado.estado === 'ok').length;
    const pct = items.length ? Math.round((listos / items.length) * 100) : 0;
    return `<li><a href="#/portafolio/${pf.id}"><span>📁</span><div><b>${esc(nombrePersona(pf.agricultorId))}</b>
      <small>Ciclo ${esc(pf.ciclo)} · ${(pf.parcelas || []).length} parcela(s) · ${listos} de ${items.length} documentos listos</small>
      <div class="progreso"><i style="width:${pct}%"></i></div></div></a></li>`;
  }

  function vistaPortafolios() {
    const pfs = A.lista('portafolio').sort((a, b) => (b.ciclo || '').localeCompare(a.ciclo || '') || nombrePersona(a.agricultorId).localeCompare(nombrePersona(b.agricultorId), 'es'));
    const ciclos = [...new Set(pfs.map((p) => p.ciclo))];
    principal().innerHTML = `
      <div class="fila entre"><h2>Portafolios</h2><button class="prim" id="nuevo">+ Nuevo portafolio</button></div>
      <input type="search" class="filtro" placeholder="Filtrar por agricultor o ciclo…">
      <div id="lista">${ciclos.map((ci) => `<h4>Ciclo ${esc(ci)}</h4><ul class="lista">${pfs.filter((p) => p.ciclo === ci).map((pf) =>
        htmlFilaPortafolio(pf).replace('<li>', `<li data-texto="${esc(U.normal(nombrePersona(pf.agricultorId) + ' ' + pf.ciclo))}">`)).join('')}</ul>`).join('')
        || '<p class="vacio">Aún no hay portafolios.</p>'}</div>`;
    $('#nuevo').onclick = ventanaNuevoPortafolio;
    conectarFiltro();
  }

  function ventanaNuevoPortafolio() {
    const anio = new Date().getFullYear();
    const v = ventana('Nuevo portafolio', `<form id="fNuevo">
      <label>Agricultor${htmlSelectPersona('agricultorId', '', true)}</label>
      <label>Ciclo agrícola<input name="ciclo" class="mayus" required value="O-I ${anio}-${anio + 1}"></label>
      <fieldset><legend>¿Qué documentos del agricultor lleva?</legend>
        ${Object.keys(U.DOCS_PERSONA).map((t) => `<label class="check"><input type="checkbox" name="req" value="${t}" checked> ${esc(U.DOCS_PERSONA[t].nombre)}</label>`).join('')}
      </fieldset>
      <fieldset><legend>En parcelas propias lleva:</legend>
        <label class="check"><input type="checkbox" name="propia" value="CERT" checked> Certificado parcelario (o carta notariada)</label>
      </fieldset>
      <fieldset><legend>En parcelas rentadas lleva:</legend>
        ${Object.keys(PIEZAS_RENTA).map((k) => `<label class="check"><input type="checkbox" name="renta" value="${k}" checked> ${esc(PIEZAS_RENTA[k])}</label>`).join('')}
      </fieldset>
      <div class="fila fin"><button class="prim">Crear portafolio</button></div></form>`, { fijo: true });
    conectarSelectPersona(v.el);
    v.el.querySelector('form').onsubmit = async (e) => {
      e.preventDefault();
      const f = e.target;
      if (!f.agricultorId.value) { aviso('Elige al agricultor', 'error'); return; }
      const valores = (n) => $$(`input[name=${n}]:checked`, f).map((i) => i.value);
      const ciclo = f.ciclo.value.trim().toUpperCase();
      const existe = A.lista('portafolio').find((p) => p.agricultorId === f.agricultorId.value && p.ciclo === ciclo);
      if (existe && !confirm('Este agricultor ya tiene un portafolio para ese ciclo. ¿Crear otro?')) return;
      // Agrega automáticamente las parcelas propias del agricultor
      const propias = A.lista('parcela').filter((x) => x.propietarioId === f.agricultorId.value)
        .map((x) => ({ id: A.nuevoId(), parcelaId: x.id, tenencia: 'propia' }));
      const pf = await A.guardar('portafolio', {
        agricultorId: f.agricultorId.value, ciclo, requeridos: valores('req'), propiaIncluye: valores('propia'),
        rentaIncluye: valores('renta'), parcelas: propias, orden: [], excluidos: [], extras: []
      });
      v.cerrar();
      ir('#/portafolio/' + pf.id);
    };
  }

  // Lista de documentos del portafolio, con su estado
  function itemsPortafolio(pf) {
    const items = [];
    const ag = A.obtener('persona', pf.agricultorId);
    (pf.requeridos || []).forEach((t) => {
      const doc = ag && (ag.docs || {})[t];
      items.push({ clave: 'p:' + t, grupo: 'Agricultor', titulo: `${U.DOCS_PERSONA[t].nombre} — ${ag ? ag.nombre : ''}`,
        archivoId: doc && doc.archivoId, estado: U.estadoDoc(t, doc), ir: ag ? '#/persona/' + ag.id : null });
    });
    (pf.parcelas || []).forEach((e, i) => {
      const x = A.obtener('parcela', e.parcelaId);
      const grupo = `Parcela ${i + 1}: ${x ? nombreParcela(x.id) : '—'} (${e.tenencia})`;
      if (e.tenencia === 'propia') {
        if ((pf.propiaIncluye || []).includes('CERT')) {
          const d = x && ((x.docs || {}).CERTIFICADO || (x.docs || {}).CARTA);
          items.push({ clave: `e:${e.id}:CERT`, grupo, titulo: 'Certificado parcelario / documento de propiedad',
            archivoId: d && d.archivoId, estado: d ? { estado: 'ok', texto: 'Listo' } : { estado: 'falta', texto: 'Falta subirlo en la parcela' }, ir: x ? '#/parcela/' + x.id : null });
        }
      } else {
        const c = A.obtener('contrato', e.contratoId);
        const incl = pf.rentaIncluye || [];
        if (incl.includes('CONTRATO')) {
          items.push({ clave: `e:${e.id}:CONTRATO`, grupo, titulo: 'Contrato de arrendamiento firmado', archivoId: c && c.firmadoId,
            estado: !c ? { estado: 'falta', texto: 'Falta hacer el contrato' } : c.firmadoId ? { estado: 'ok', texto: 'Listo' } : { estado: 'falta', texto: 'Falta subir el contrato firmado' },
            ir: c ? '#/contrato/' + c.id : null });
        }
        const claves = ['INE_PARCELERO', 'INE_INVERSIONISTA', 'INE_T1', 'INE_T2', 'CERT'];
        const anexos = c ? anexosContrato(c) : null;
        claves.forEach((k, j) => {
          if (!incl.includes(k)) return;
          const a = anexos ? anexos[j] : { titulo: PIEZAS_RENTA[k], estado: { estado: 'falta', texto: 'Falta hacer el contrato' } };
          items.push({ clave: `e:${e.id}:${k}`, grupo, titulo: a.titulo, archivoId: a.archivoId, estado: a.estado, ir: a.ir });
        });
      }
    });
    (pf.extras || []).forEach((x) => {
      items.push({ clave: 'x:' + x.id, grupo: 'Otros documentos', titulo: x.nombre, archivoId: x.archivoId, estado: { estado: 'ok', texto: 'Listo' }, extra: true });
    });
    return items;
  }

  function itemsOrdenados(pf) {
    const items = itemsPortafolio(pf);
    const mapa = {};
    items.forEach((i) => { mapa[i.clave] = i; });
    const orden = (pf.orden || []).filter((k) => mapa[k]);
    items.forEach((i) => { if (!orden.includes(i.clave)) orden.push(i.clave); });
    return orden.map((k) => mapa[k]);
  }

  async function vistaPortafolio(id) {
    const pf = A.obtener('portafolio', id);
    if (!pf) { principal().innerHTML = '<p>No se encontró el portafolio.</p>'; return; }
    pf.excluidos = pf.excluidos || []; pf.extras = pf.extras || []; pf.parcelas = pf.parcelas || [];
    const items = itemsOrdenados(pf);
    const incluidos = items.filter((i) => !pf.excluidos.includes(i.clave));
    const faltan = incluidos.filter((i) => i.estado.estado !== 'ok');
    principal().innerHTML = `
      <a href="#/portafolios" class="volver">← Portafolios</a>
      <div class="fila entre"><h2>${esc(nombrePersona(pf.agricultorId))}</h2>
        <button class="sec chico" id="editarPf">Editar</button></div>
      <p class="sub">Ciclo ${esc(pf.ciclo)}</p>
      <div class="alerta ${faltan.length ? 'roja' : 'verde'}">${faltan.length
        ? `Faltan o hay que revisar <b>${faltan.length}</b> de ${incluidos.length} documentos.`
        : `✅ Portafolio completo: ${incluidos.length} documentos listos.`}</div>

      <section class="tarjeta">
        <div class="fila entre"><h3>Parcelas</h3><button class="sec chico" id="agregarParcela">+ Agregar parcela</button></div>
        ${pf.parcelas.length ? `<ul class="lista">${pf.parcelas.map((e) => {
          const c = A.obtener('contrato', e.contratoId);
          return `<li><div class="li-cont"><span>${e.tenencia === 'propia' ? '🏡' : '🤝'}</span><div><b>${esc(nombreParcela(e.parcelaId))}</b>
            <small>${e.tenencia === 'propia' ? 'Propia' : `Rentada a ${esc(nombrePersona((A.obtener('parcela', e.parcelaId) || {}).propietarioId))}`}</small></div>
            <div class="acciones">${e.tenencia === 'rentada' ? (c ? `<a class="boton sec chico" href="#/contrato/${c.id}">Ver contrato</a>` : `<button class="prim chico" data-contrato="${e.id}">Hacer contrato</button>`) : ''}
            <button class="sec chico" data-quitar="${e.id}" title="Quitar del portafolio">Quitar</button></div></div></li>`;
        }).join('')}</ul>` : '<p class="vacio">Agrega las parcelas que siembra el agricultor este ciclo.</p>'}
      </section>

      <section class="tarjeta">
        <div class="fila entre"><h3>Documentos y orden de impresión</h3><button class="sec chico" id="agregarExtra">+ Otro documento</button></div>
        <p class="ayuda">Usa las flechas para cambiar el orden. Desmarca la casilla para no incluir un documento en el PDF.</p>
        <ol class="orden" id="orden">${items.map((it, i) => `
          <li class="${pf.excluidos.includes(it.clave) ? 'excluido' : ''} est-${it.estado.estado}" data-clave="${esc(it.clave)}">
            <input type="checkbox" ${pf.excluidos.includes(it.clave) ? '' : 'checked'} data-incluir title="Incluir en el PDF">
            <span class="num">${i + 1}</span>
            <div class="orden-info"><b>${U.ICONO[it.estado.estado]} ${esc(it.titulo)}</b><small>${esc(it.grupo)} · ${esc(it.estado.texto)}</small></div>
            <div class="acciones">
              ${it.archivoId ? '<button class="sec chico" data-ver>Ver</button>' : ''}
              ${it.ir ? `<a class="sec chico boton" href="${it.ir}">${it.estado.estado === 'ok' ? 'Abrir' : 'Corregir'}</a>` : ''}
              ${it.extra ? '<button class="sec chico" data-borrarextra>Quitar</button>' : ''}
              <button class="flecha" data-mover="-1" ${i === 0 ? 'disabled' : ''} aria-label="Subir">▲</button>
              <button class="flecha" data-mover="1" ${i === items.length - 1 ? 'disabled' : ''} aria-label="Bajar">▼</button>
            </div></li>`).join('')}</ol>
        <div class="fila fin"><button class="sec chico" id="ordenDefecto">Restablecer orden</button></div>
      </section>

      <section class="tarjeta">
        <h3>Descargar portafolio</h3>
        <p class="ayuda">«Orden inverso» pone la última hoja primero, para que al terminar de imprimir todo quede acomodado.</p>
        <div class="columna">
          <button class="prim grande" data-pdf="normal">📄 PDF en orden</button>
          <button class="prim grande" data-pdf="inverso">🔃 PDF en orden inverso (para imprimir)</button>
        </div>
      </section>
      <div class="fila fin"><button class="peligro" id="borrarPf">Eliminar portafolio</button></div>`;

    const guardarPf = async () => { await A.guardar('portafolio', pf); };

    $('#editarPf').onclick = () => ventanaEditarPortafolio(pf);
    $('#agregarParcela').onclick = () => ventanaAgregarParcela(pf);
    $('#agregarExtra').onclick = async () => {
      const arch = await subirArchivo('Documento extra');
      if (!arch) return;
      const nombre = prompt('Nombre del documento:', arch.nombre.replace(/\.[^.]+$/, '')) || arch.nombre;
      pf.extras.push({ id: A.nuevoId(), nombre, archivoId: arch.id });
      await guardarPf(); vistaPortafolio(pf.id);
    };
    $$('[data-quitar]').forEach((b) => b.onclick = async () => {
      const e = pf.parcelas.find((x) => x.id === b.dataset.quitar);
      if (!confirm('¿Quitar esta parcela del portafolio?' + (e.contratoId ? '\nEl contrato no se borra, sigue en «Contratos».' : ''))) return;
      if (e.contratoId) { const c = A.obtener('contrato', e.contratoId); if (c) { delete c.portafolioId; await A.guardar('contrato', c); } }
      pf.parcelas = pf.parcelas.filter((x) => x.id !== e.id);
      await guardarPf(); vistaPortafolio(pf.id);
    });
    $$('[data-contrato]').forEach((b) => b.onclick = async () => {
      const e = pf.parcelas.find((x) => x.id === b.dataset.contrato);
      const c = await A.guardar('contrato', Object.assign(contratoInicial(e.parcelaId, pf.agricultorId, pf.ciclo), { portafolioId: pf.id }));
      e.contratoId = c.id;
      await guardarPf();
      ir('#/contrato/' + c.id);
    });
    $$('#orden li').forEach((li) => {
      const clave = li.dataset.clave;
      li.querySelector('[data-incluir]').onchange = async (ev) => {
        pf.excluidos = pf.excluidos.filter((k) => k !== clave);
        if (!ev.target.checked) pf.excluidos.push(clave);
        await guardarPf(); vistaPortafolio(pf.id);
      };
      $$('[data-mover]', li).forEach((b) => b.onclick = async () => {
        const orden = itemsOrdenados(pf).map((i) => i.clave);
        const i = orden.indexOf(clave), j = i + Number(b.dataset.mover);
        [orden[i], orden[j]] = [orden[j], orden[i]];
        pf.orden = orden;
        await guardarPf(); await vistaPortafolio(pf.id);
        const nuevo = $(`#orden li[data-clave="${CSS.escape(clave)}"]`);
        if (nuevo) { nuevo.scrollIntoView({ block: 'center' }); nuevo.classList.add('resaltar'); }
      });
      const ver = li.querySelector('[data-ver]');
      if (ver) ver.onclick = () => verArchivo(items.find((i) => i.clave === clave).archivoId);
      const be = li.querySelector('[data-borrarextra]');
      if (be) be.onclick = async () => {
        if (!confirm('¿Quitar este documento?')) return;
        const x = pf.extras.find((e) => 'x:' + e.id === clave);
        await A.eliminarArchivo(x.archivoId);
        pf.extras = pf.extras.filter((e) => e !== x);
        await guardarPf(); vistaPortafolio(pf.id);
      };
    });
    $('#ordenDefecto').onclick = async () => { pf.orden = []; await guardarPf(); vistaPortafolio(pf.id); };
    $$('[data-pdf]').forEach((b) => b.onclick = () => descargarPortafolio(pf, b.dataset.pdf === 'inverso', b));
    $('#borrarPf').onclick = async () => {
      if (!confirm('¿Eliminar este portafolio? Las personas, parcelas, contratos y sus documentos NO se borran.')) return;
      for (const x of pf.extras) await A.eliminarArchivo(x.archivoId);
      for (const e of pf.parcelas) { const c = A.obtener('contrato', e.contratoId); if (c) { delete c.portafolioId; await A.guardar('contrato', c); } }
      await A.eliminar('portafolio', pf.id);
      ir('#/portafolios');
    };
  }

  function ventanaEditarPortafolio(pf) {
    const v = ventana('Editar portafolio', `<form>
      <label>Ciclo agrícola<input name="ciclo" class="mayus" value="${esc(pf.ciclo)}" required></label>
      <fieldset><legend>Documentos del agricultor</legend>
        ${Object.keys(U.DOCS_PERSONA).map((t) => `<label class="check"><input type="checkbox" name="req" value="${t}" ${(pf.requeridos || []).includes(t) ? 'checked' : ''}> ${esc(U.DOCS_PERSONA[t].nombre)}</label>`).join('')}
      </fieldset>
      <fieldset><legend>En parcelas propias</legend>
        <label class="check"><input type="checkbox" name="propia" value="CERT" ${(pf.propiaIncluye || []).includes('CERT') ? 'checked' : ''}> Certificado parcelario</label></fieldset>
      <fieldset><legend>En parcelas rentadas</legend>
        ${Object.keys(PIEZAS_RENTA).map((k) => `<label class="check"><input type="checkbox" name="renta" value="${k}" ${(pf.rentaIncluye || []).includes(k) ? 'checked' : ''}> ${esc(PIEZAS_RENTA[k])}</label>`).join('')}
      </fieldset>
      <div class="fila fin"><button class="prim">Guardar</button></div></form>`);
    v.el.querySelector('form').onsubmit = async (e) => {
      e.preventDefault();
      const f = e.target;
      const valores = (n) => $$(`input[name=${n}]:checked`, f).map((i) => i.value);
      Object.assign(pf, { ciclo: f.ciclo.value.trim().toUpperCase(), requeridos: valores('req'), propiaIncluye: valores('propia'), rentaIncluye: valores('renta') });
      await A.guardar('portafolio', pf);
      v.cerrar(); vistaPortafolio(pf.id);
    };
  }

  function ventanaAgregarParcela(pf) {
    const usadas = pf.parcelas.map((e) => e.parcelaId);
    const v = ventana('Agregar parcela al portafolio', `<form>
      <label>Parcela${htmlSelectParcela('parcelaId', '', usadas)}</label>
      <fieldset><legend>¿Cómo la trabaja el agricultor?</legend>
        <label class="check"><input type="radio" name="tenencia" value="propia"> Es suya (propia)</label>
        <label class="check"><input type="radio" name="tenencia" value="rentada" checked> La renta (necesita contrato)</label>
      </fieldset>
      <div id="contratoExistente"></div>
      <div class="fila fin"><button class="prim">Agregar</button></div></form>`, { fijo: true });
    const f = v.el.querySelector('form');
    conectarSelectParcela(f);
    const actualizar = () => {
      const x = A.obtener('parcela', f.parcelaId.value);
      if (x) f.tenencia.value = x.propietarioId === pf.agricultorId ? 'propia' : 'rentada';
      const cs = A.lista('contrato').filter((c) => c.parcelaId === f.parcelaId.value && c.inversionistaId === pf.agricultorId && !c.portafolioId);
      $('#contratoExistente', v.el).innerHTML = cs.length ? `<label>Usar un contrato ya hecho<select name="contratoId"><option value="">No, hacer uno nuevo</option>
        ${cs.map((c) => `<option value="${c.id}">Ciclo ${esc(c.ciclo)} · ${esc(U.fechaCorta(c.fechaFirma))}</option>`).join('')}</select></label>` : '';
    };
    f.parcelaId.addEventListener('change', actualizar);
    f.onsubmit = async (e) => {
      e.preventDefault();
      if (!f.parcelaId.value) { aviso('Elige una parcela', 'error'); return; }
      const entrada = { id: A.nuevoId(), parcelaId: f.parcelaId.value, tenencia: f.tenencia.value };
      if (entrada.tenencia === 'rentada' && f.contratoId && f.contratoId.value) {
        entrada.contratoId = f.contratoId.value;
        const c = A.obtener('contrato', entrada.contratoId);
        c.portafolioId = pf.id; await A.guardar('contrato', c);
      }
      pf.parcelas.push(entrada);
      await A.guardar('portafolio', pf);
      v.cerrar(); vistaPortafolio(pf.id);
    };
  }

  async function descargarPortafolio(pf, inverso, boton) {
    const items = itemsOrdenados(pf).filter((i) => !pf.excluidos.includes(i.clave));
    const sinArchivo = items.filter((i) => !i.archivoId);
    if (sinArchivo.length && !confirm(`Faltan ${sinArchivo.length} documento(s) que no se incluirán:\n\n• ${sinArchivo.map((i) => i.titulo).join('\n• ')}\n\n¿Descargar de todos modos?`)) return;
    const txt = boton.textContent;
    boton.disabled = true; boton.textContent = 'Armando PDF…';
    try {
      const archivos = [];
      for (const it of items.filter((i) => i.archivoId)) {
        const a = await A.leerArchivo(it.archivoId);
        if (a) archivos.push({ bytes: a.bytes, mime: a.mime, titulo: it.titulo });
      }
      const r = await PDFs.unir(archivos, inverso);
      if (r.errores.length) alert('Algunos documentos no se pudieron agregar:\n\n' + r.errores.join('\n'));
      const nombre = `PORTAFOLIO ${nombrePersona(pf.agricultorId)} ${pf.ciclo}${inverso ? ' (INVERSO)' : ''}.pdf`.replace(/[\\/:*?"<>|]/g, '-');
      aviso(`PDF listo: ${r.paginas} hojas`);
      await PDFs.guardarEnDispositivo(r.bytes, nombre, 'application/pdf');
    } catch (e) {
      console.error(e); aviso('Error al armar el PDF: ' + e.message, 'error');
    } finally {
      boton.disabled = false; boton.textContent = txt;
    }
  }

  /* =====================================================================
     8. BÚSQUEDA
     ===================================================================== */
  function vistaBuscar(q) {
    q = q || '';
    $('#cajaBuscar').value = q;
    const nq = U.normal(q).trim();
    const tiene = (...campos) => campos.some((c) => U.normal(c).includes(nq));
    const r = !nq ? null : {
      personas: A.lista('persona').filter((p) => tiene(p.nombre, p.curp, p.rfc, p.telefono, p.domicilio, p.cargo, p.notas)),
      parcelas: A.lista('parcela').filter((x) => tiene(x.numero, x.certificado, x.ejido, x.municipio, nombrePersona(x.propietarioId), ...Object.values(x.colindancias || {}))),
      contratos: A.lista('contrato').filter((c) => tiene(tituloContrato(c), c.ciclo, c.ejido, c.cultivo, nombrePersona(c.testigo1Id), nombrePersona(c.testigo2Id))),
      portafolios: A.lista('portafolio').filter((pf) => tiene(nombrePersona(pf.agricultorId), pf.ciclo, ...(pf.extras || []).map((x) => x.nombre),
        ...(pf.parcelas || []).map((e) => nombreParcela(e.parcelaId) + ' ' + nombrePersona((A.obtener('parcela', e.parcelaId) || {}).propietarioId))))
    };
    const total = r ? Object.values(r).reduce((s, l) => s + l.length, 0) : 0;
    const bloque = (titulo, lista, fila) => lista.length ? `<section class="tarjeta"><h3>${titulo} (${lista.length})</h3><ul class="lista">${lista.map(fila).join('')}</ul></section>` : '';
    principal().innerHTML = `<h2>Buscar</h2>
      <p class="ayuda">Busca por nombre, CURP, RFC, teléfono, número de parcela o certificado, ejido, ciclo, colindancias…</p>
      ${!r ? '' : total === 0 ? `<p class="vacio">No se encontró nada con «${esc(q)}».</p>` : `
      ${bloque('Personas', r.personas, (p) => `<li><a href="#/persona/${p.id}"><span>👤</span><div><b>${esc(p.nombre)}</b><small>${esc([p.cargo, p.curp, p.rfc].filter(Boolean).join(' · '))}</small></div></a></li>`)}
      ${bloque('Parcelas', r.parcelas, (x) => `<li><a href="#/parcela/${x.id}"><span>🌾</span><div><b>${esc(nombreParcela(x.id))}</b><small>Dueño: ${esc(nombrePersona(x.propietarioId))}</small></div></a></li>`)}
      ${bloque('Contratos', r.contratos, (c) => `<li><a href="#/contrato/${c.id}"><span>📝</span><div><b>${esc(tituloContrato(c))}</b><small>Ciclo ${esc(c.ciclo)}</small></div></a></li>`)}
      ${bloque('Portafolios', r.portafolios, htmlFilaPortafolio)}`}`;
  }

  /* =====================================================================
     9. RESPALDO Y AJUSTES
     ===================================================================== */
  async function vistaRespaldo() {
    const esp = await A.espacioUsado();
    const ultimo = localStorage.getItem('ultimoRespaldo__' + A.usuario);
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const instalada = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    principal().innerHTML = `
      <h2>Respaldo y ajustes</h2>
      <section class="tarjeta">
        <h3>💾 Respaldo</h3>
        <p>El respaldo es <b>un solo archivo cifrado</b> con todas tus personas, parcelas, contratos, portafolios y documentos.
        Guárdalo en una USB, en tu computadora o en la nube. Para abrirlo se necesita tu usuario y contraseña.</p>
        <p class="sub">Último respaldo en este dispositivo: <b>${ultimo ? U.fechaCorta(ultimo) : 'nunca'}</b></p>
        <div class="columna">
          <button class="prim grande" id="exportar">⬇️ Hacer respaldo (descargar)</button>
          <button class="sec grande" id="importar">⬆️ Cargar un respaldo</button>
        </div>
        <p class="ayuda">Cargar un respaldo agrega su información a la de este dispositivo. Si un registro ya existe, se reemplaza por el del respaldo. Úsalo también para pasar tu información a otro celular o computadora.</p>
      </section>
      <section class="tarjeta">
        <h3>📱 Este dispositivo</h3>
        ${esp ? `<p>Espacio usado: <b>${U.tamano(esp.usado)}</b> de ${U.tamano(esp.cuota)} disponibles.</p>
          <p>Almacenamiento protegido contra borrado automático: <b>${esp.persistente ? 'Sí ✅' : 'No ⚠️'}</b></p>` : ''}
        ${ios && !instalada ? `<div class="alerta amarilla"><b>Importante en iPhone/iPad:</b> instala la app para que iOS no borre tus datos.
          En Safari toca <b>Compartir</b> (□↑) y luego <b>«Agregar a pantalla de inicio»</b>. Después ábrela siempre desde ese ícono.</div>` : ''}
        ${!ios && !instalada ? '<p class="ayuda">Puedes instalar la app desde el menú del navegador («Instalar aplicación» o «Agregar a pantalla de inicio») para usarla sin internet como cualquier programa.</p>' : ''}
      </section>
      <section class="tarjeta">
        <h3>🔑 Cambiar contraseña</h3>
        <p class="ayuda">La app te dará una línea para pegar en <code>config.js</code> en GitHub. Hasta que la pegues, seguirás entrando con la contraseña anterior.</p>
        <button class="sec" id="cambiar">Cambiar contraseña</button>
      </section>
      <p class="ayuda centro">Usuario: <b>${esc(A.usuario)}</b> · Versión ${esc(window.VERSION_APP || '')}</p>`;

    $('#exportar').onclick = async (ev) => {
      const b = ev.target; b.disabled = true; b.textContent = 'Preparando…';
      try {
        const blob = await A.exportarRespaldo();
        const nombre = `respaldo-${A.usuario}-${U.hoyISO()}.respaldo`;
        await PDFs.guardarEnDispositivo(new Uint8Array(await blob.arrayBuffer()), nombre, 'application/octet-stream');
        localStorage.setItem('ultimoRespaldo__' + A.usuario, new Date().toISOString());
        aviso(`Respaldo listo (${U.tamano(blob.size)})`);
      } catch (e) { aviso('Error: ' + e.message, 'error'); }
      vistaRespaldo();
    };
    $('#importar').onclick = async () => {
      const file = await U.elegirArchivo('.respaldo,application/octet-stream');
      if (!file) return;
      const p = await U.pedirContrasena('Cargar respaldo', 'Escribe la contraseña con la que se hizo este respaldo.');
      if (!p) return;
      try {
        aviso('Cargando respaldo…');
        const r = await A.importarRespaldo(await file.arrayBuffer(), p, usuarioConfig.sal);
        alert(`Respaldo cargado.\n\nDel ${U.fechaCorta(r.fecha)}: ${r.registros} registros y ${r.archivos} archivos.`);
        ir('#/inicio');
      } catch (e) { alert('No se pudo cargar el respaldo:\n' + e.message); }
    };
    $('#cambiar').onclick = () => {
      const v = ventana('Cambiar contraseña', `<form>
        <label>Contraseña actual<input type="password" name="a" required autocomplete="current-password"></label>
        <label>Contraseña nueva (mínimo 8 caracteres)<input type="password" name="n" minlength="8" required autocomplete="new-password"></label>
        <label>Repite la contraseña nueva<input type="password" name="n2" minlength="8" required autocomplete="new-password"></label>
        <div class="fila fin"><button class="prim">Continuar</button></div></form><div id="resultado"></div>`);
      v.el.querySelector('form').onsubmit = async (e) => {
        e.preventDefault();
        const f = e.target;
        if (f.n.value !== f.n2.value) { aviso('Las contraseñas nuevas no coinciden', 'error'); return; }
        if ((await Cripto.calcularVerificador(f.a.value, usuarioConfig.sal)) !== usuarioConfig.verificador) { aviso('La contraseña actual no es correcta', 'error'); return; }
        await A.agregarContrasena(f.n.value, usuarioConfig.sal);
        const ver = await Cripto.calcularVerificador(f.n.value, usuarioConfig.sal);
        const linea = `  { usuario: '${usuarioConfig.usuario}', nombre: '${(usuarioConfig.nombre || '').replace(/'/g, "\\'")}', sal: '${usuarioConfig.sal}', verificador: '${ver}' },`;
        f.remove();
        $('#resultado', v.el).innerHTML = `<p>Listo. En GitHub abre <code>config.js</code> y reemplaza la línea de <b>${esc(usuarioConfig.usuario)}</b> por esta:</p>
          <textarea readonly rows="4" class="codigo">${esc(linea)}</textarea>
          <button class="prim" id="copiar">Copiar</button>
          <p class="ayuda">Haz lo mismo en cada dispositivo donde uses la app: entra con la contraseña anterior, cambia la contraseña aquí, y después actualiza config.js.</p>`;
        $('#copiar', v.el).onclick = () => { navigator.clipboard.writeText(linea).then(() => aviso('Copiado')); };
      };
    };
  }

  /* =====================================================================
     10. PIEZAS COMPARTIDAS
     ===================================================================== */

  // ---- Selector de persona, con opción de crear una nueva al momento ----
  function htmlSelectPersona(nombre, valor, requerido) {
    const ps = A.lista('persona').sort(porNombre);
    return `<select name="${nombre}" data-persona ${requerido ? 'required' : ''}>
      <option value="">— Elegir —</option>
      ${ps.map((p) => `<option value="${p.id}" ${p.id === valor ? 'selected' : ''}>${esc(p.nombre)}${p.cargo ? ' (' + esc(p.cargo) + ')' : ''}</option>`).join('')}
      <option value="__nueva">+ Registrar persona nueva…</option></select>`;
  }

  function conectarSelectPersona(raiz) {
    $$('select[data-persona]', raiz).forEach((sel) => {
      let anterior = sel.value;
      sel.addEventListener('change', () => {
        if (sel.value !== '__nueva') { anterior = sel.value; return; }
        sel.value = anterior;
        const v = ventana('Nueva persona', `<form>
          <label>Nombre completo (APELLIDOS NOMBRES)<input name="nombre" required class="mayus"></label>
          <label>Sexo<select name="sexo"><option value="H">Hombre</option><option value="M">Mujer</option></select></label>
          <label>Cargo o papel (opcional)<input name="cargo" placeholder="Ej. Comisariado ejidal"></label>
          <p class="ayuda">Después podrás subir sus documentos desde «Personas».</p>
          <div class="fila fin"><button class="prim">Guardar</button></div></form>`);
        v.el.querySelector('form').onsubmit = async (e) => {
          e.preventDefault();
          const f = e.target;
          const p = await A.guardar('persona', { nombre: f.nombre.value.trim().toUpperCase(), sexo: f.sexo.value, cargo: f.cargo.value.trim(), docs: {} });
          // Agrega la persona a todos los selectores de la pantalla
          $$('select[data-persona]').forEach((s) => {
            const op = document.createElement('option');
            op.value = p.id; op.textContent = p.nombre + (p.cargo ? ` (${p.cargo})` : '');
            s.insertBefore(op, s.querySelector('option[value="__nueva"]'));
          });
          sel.value = p.id; anterior = p.id;
          sel.dispatchEvent(new Event('change'));
          v.cerrar();
        };
      });
    });
  }

  // ---- Selector de parcela, con opción de crear una nueva al momento ----
  function htmlSelectParcela(nombre, valor, ocultar) {
    const xs = A.lista('parcela').filter((x) => !(ocultar || []).includes(x.id))
      .sort((a, b) => nombrePersona(a.propietarioId).localeCompare(nombrePersona(b.propietarioId), 'es'));
    return `<select name="${nombre}" data-parcela>
      <option value="">— Elegir —</option>
      ${xs.map((x) => `<option value="${x.id}" ${x.id === valor ? 'selected' : ''}>${esc(nombrePersona(x.propietarioId))} — ${esc(nombreParcela(x.id))}</option>`).join('')}
      <option value="__nueva">+ Registrar parcela nueva…</option></select>`;
  }

  function conectarSelectParcela(raiz) {
    $$('select[data-parcela]', raiz).forEach((sel) => {
      let anterior = sel.value;
      sel.addEventListener('change', (ev) => {
        if (sel.value !== '__nueva') { anterior = sel.value; return; }
        ev.stopImmediatePropagation();
        sel.value = anterior;
        const v = ventana('Nueva parcela', `<form>
          <label>Dueño (parcelero)${htmlSelectPersona('propietarioId', '', true)}</label>
          <div class="rejilla">
            <label>Número de parcela<input name="numero"></label>
            <label>Hectáreas<input name="hectareas" inputmode="decimal" required></label>
            <label>Ejido<input name="ejido" class="mayus" required></label>
            <label>Municipio<input name="municipio" class="mayus"></label>
            ${['norte', 'sur', 'este', 'oeste'].map((c) => `<label>Al ${c}<input name="col_${c}" class="mayus"></label>`).join('')}
          </div>
          <p class="ayuda">El certificado parcelario se sube después desde «Parcelas».</p>
          <div class="fila fin"><button class="prim">Guardar</button></div></form>`, { ancho: true });
        conectarSelectPersona(v.el);
        v.el.querySelector('form').onsubmit = async (e) => {
          e.preventDefault();
          const f = e.target;
          if (!f.propietarioId.value) { aviso('Elige al dueño', 'error'); return; }
          const x = await A.guardar('parcela', {
            propietarioId: f.propietarioId.value, numero: f.numero.value.trim(), hectareas: f.hectareas.value.trim(),
            ejido: f.ejido.value.trim().toUpperCase(), municipio: f.municipio.value.trim().toUpperCase(), estado: 'SINALOA',
            colindancias: { norte: f.col_norte.value.trim(), sur: f.col_sur.value.trim(), este: f.col_este.value.trim(), oeste: f.col_oeste.value.trim() }, docs: {}
          });
          const op = document.createElement('option');
          op.value = x.id; op.textContent = `${nombrePersona(x.propietarioId)} — ${nombreParcela(x.id)}`;
          sel.insertBefore(op, sel.querySelector('option[value="__nueva"]'));
          sel.value = x.id; anterior = x.id;
          v.cerrar();
          sel.dispatchEvent(new Event('change'));
        };
      });
    });
  }

  // ---- Casilla de documento (subir, ver, editar, quitar) ----
  function htmlSlot(clave, titulo, doc, tipo) {
    const e = tipo ? U.estadoDoc(tipo, doc) : (doc && doc.archivoId ? { estado: 'ok', texto: 'Listo' } : { estado: 'falta', texto: 'Falta' });
    const meta = doc && doc.archivoId ? A.obtener('archivo', doc.archivoId) : null;
    const info = tipo ? U.DOCS_PERSONA[tipo] : {};
    const esFoto = meta && meta.mime && meta.mime.startsWith('image/');
    return `<div class="slot est-${e.estado}" data-slot="${clave}">
      <div class="slot-info"><b>${U.ICONO[e.estado]} ${esc(titulo)}</b>
        <small>${esc(e.texto)}${meta ? ` · ${esFoto ? 'foto' : 'PDF'} ${U.tamano(meta.tamano)}` : ''}</small>
        ${doc && doc.archivoId && (info.meses || info.dias) ? `<label class="en-linea">Fecha de emisión <input type="date" data-fecha value="${esc(doc.fecha || '')}"></label>` : ''}
        ${doc && doc.archivoId && info.venceAnio ? `<label class="en-linea">Vigencia (año) <input type="number" min="2000" max="2100" data-vigencia value="${esc(doc.vigencia || '')}" placeholder="${new Date().getFullYear() + 5}"></label>` : ''}
      </div>
      <div class="slot-botones">
        ${meta ? `<button type="button" class="sec chico" data-s="ver">Ver</button>
          <button type="button" class="sec chico" data-s="editar">${esFoto ? 'Editar' : 'Girar'}</button>
          <button type="button" class="sec chico" data-s="descargar">Descargar</button>
          <button type="button" class="sec chico" data-s="subir">Reemplazar</button>
          <button type="button" class="peligro chico" data-s="quitar">Quitar</button>`
        : `<button type="button" class="prim chico" data-s="subir">Subir</button>`}
      </div></div>`;
  }

  // ops = { obtener(clave), guardar(clave, doc|null), refrescar(), nombreArchivo(clave) }
  function conectarSlots(contenedor, ops) {
    if (!contenedor) return;
    $$('[data-slot]', contenedor).forEach((div) => {
      const clave = div.dataset.slot;
      const fecha = div.querySelector('[data-fecha]');
      if (fecha) fecha.onchange = async () => { const d = ops.obtener(clave); d.fecha = fecha.value; await ops.guardar(clave, d); ops.refrescar(); };
      const vig = div.querySelector('[data-vigencia]');
      if (vig) vig.onchange = async () => { const d = ops.obtener(clave); d.vigencia = vig.value ? Number(vig.value) : null; await ops.guardar(clave, d); ops.refrescar(); };
      $$('[data-s]', div).forEach((b) => b.onclick = async () => {
        const doc = ops.obtener(clave);
        const accion = b.dataset.s;
        if (accion === 'subir') {
          const arch = await subirArchivo(ops.nombreArchivo(clave));
          if (!arch) return;
          if (doc && doc.archivoId) await A.eliminarArchivo(doc.archivoId);
          const nuevo = { archivoId: arch.id, subido: new Date().toISOString() };
          const info = U.DOCS_PERSONA[clave];
          if (info && (info.meses || info.dias || info.venceAnio)) Object.assign(nuevo, await pedirVigencia(info));
          await ops.guardar(clave, nuevo);
          aviso('Documento guardado');
          ops.refrescar();
        } else if (accion === 'ver') {
          verArchivo(doc.archivoId);
        } else if (accion === 'descargar') {
          const a = await A.leerArchivo(doc.archivoId);
          PDFs.guardarEnDispositivo(a.bytes, a.nombre, a.mime);
        } else if (accion === 'editar') {
          const a = await A.leerArchivo(doc.archivoId);
          let bytes, mime = a.mime;
          if (a.mime.startsWith('image/')) {
            const r = await Editor.abrir(a.bytes, a.mime);
            if (!r) return;
            bytes = r.bytes; mime = r.mime;
          } else {
            bytes = await PDFs.girarPDF(a.bytes, 90);
          }
          const nuevo = await A.guardarArchivo(bytes, a.nombre, mime);
          await A.eliminarArchivo(doc.archivoId);
          doc.archivoId = nuevo.id;
          await ops.guardar(clave, doc);
          aviso(a.mime.startsWith('image/') ? 'Foto actualizada' : 'PDF girado 90°');
          ops.refrescar();
        } else if (accion === 'quitar') {
          if (!confirm('¿Quitar este documento?')) return;
          await A.eliminarArchivo(doc.archivoId);
          await ops.guardar(clave, null);
          ops.refrescar();
        }
      });
    });
  }

  // Pregunta la fecha de emisión (constancia, opinión) o el año de vigencia (INE)
  function pedirVigencia(info) {
    return new Promise((resolver) => {
      const anio = info.venceAnio;
      const v = ventana(info.nombre, `<form>
        ${anio
          ? `<label>¿Hasta qué año es vigente? (viene impreso en la credencial, «VIGENCIA»)
              <input type="number" name="v" min="2000" max="2100" inputmode="numeric" placeholder="${new Date().getFullYear() + 5}"></label>`
          : `<label>Fecha de emisión del documento<input type="date" name="v" value="${U.hoyISO()}"></label>
             <p class="ayuda">Se usa para avisarte cuando venza (${info.meses ? info.meses + ' meses' : info.dias + ' días'}).</p>`}
        <div class="fila fin"><button type="button" class="sec" data-omitir>Después</button><button class="prim">Guardar</button></div></form>`, { fijo: true });
      const fin = (val) => { v.cerrar(); resolver(anio ? { vigencia: val ? Number(val) : null } : { fecha: val || null }); };
      v.el.querySelector('[data-omitir]').onclick = () => fin(null);
      v.el.querySelector('.cerrar').onclick = () => fin(null);
      v.el.querySelector('form').onsubmit = (e) => { e.preventDefault(); fin(e.target.v.value); };
    });
  }

  // Elige un archivo; si es foto abre el editor. Regresa el registro del archivo guardado.
  async function subirArchivo(nombreBase) {
    const file = await U.elegirArchivo();
    if (!file) return null;
    let bytes = new Uint8Array(await file.arrayBuffer());
    let mime = file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : '');
    if (mime === 'application/pdf') {
      if ((await PDFs.contarPaginas(bytes)) === null) { aviso('Ese PDF está dañado o protegido con contraseña', 'error'); return null; }
    } else if (mime.startsWith('image/') || /\.(heic|heif|jpe?g|png|webp)$/i.test(file.name)) {
      try {
        const norm = await Editor.normalizar(bytes, mime || 'image/jpeg');
        const r = await Editor.abrir(norm.bytes, norm.mime);
        if (!r) return null;
        bytes = r.bytes; mime = r.mime;
      } catch (e) { aviso(e.message, 'error'); return null; }
    } else {
      aviso('Solo se aceptan PDF o fotos', 'error'); return null;
    }
    const ext = mime === 'application/pdf' ? '.pdf' : '.jpg';
    return A.guardarArchivo(bytes, (nombreBase || file.name).replace(/[\\/:*?"<>|]/g, '-') + ext, mime);
  }

  async function verArchivo(id) {
    const a = await A.leerArchivo(id);
    if (!a) { aviso('No se encontró el archivo', 'error'); return; }
    if (a.mime.startsWith('image/')) {
      const url = URL.createObjectURL(new Blob([a.bytes], { type: a.mime }));
      const v = ventana(a.nombre, `<img src="${url}" class="vista-foto" alt="">`, { ancho: true });
      const cerrar = v.cerrar;
      v.el.querySelector('.cerrar').onclick = () => { URL.revokeObjectURL(url); cerrar(); };
    } else {
      PDFs.abrirParaImprimir(a.bytes, a.mime);
    }
  }

  /* ---------- Arranque ---------- */
  window.addEventListener('DOMContentLoaded', () => {
    if (!window.USUARIOS || !window.USUARIOS.length) {
      $('#app').innerHTML = '<p class="error">No hay usuarios en config.js. Revisa la documentación.</p>';
      return;
    }
    if (!window.crypto || !crypto.subtle) {
      $('#app').innerHTML = '<p class="error">Este navegador no permite cifrar. Abre la app desde https:// (GitHub Pages) con Chrome, Safari o Edge actualizados.</p>';
      return;
    }
    pantallaEntrar();
    if ('serviceWorker' in navigator && location.protocol === 'https:') {
      navigator.serviceWorker.register('sw.js').then((reg) => {
        reg.addEventListener('updatefound', () => {
          const nuevo = reg.installing;
          nuevo.addEventListener('statechange', () => {
            if (nuevo.state === 'installed' && navigator.serviceWorker.controller) {
              aviso('Hay una versión nueva de la app. Cierra y vuelve a abrir para usarla.');
            }
          });
        });
      }).catch((e) => console.warn('SW', e));
    }
  });
})();
