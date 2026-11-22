/* =========================================================================
   almacen.js — Guarda todo en el dispositivo (IndexedDB), cifrado.

   Cada usuario tiene su propia base de datos: "portafolios__<usuario>".
   Tablas:
     meta       -> llaves maestras envueltas (cifradas con la contraseña)
     registros  -> personas, parcelas, portafolios y datos de archivos (cifrados)
     archivos   -> el contenido de cada PDF o foto (cifrado)

   En memoria se mantiene una copia descifrada de los registros (no de los
   archivos) para que la búsqueda y las pantallas sean rápidas.
   ========================================================================= */
(function (global) {
  'use strict';
  const C = global.Cripto;

  let db = null;          // conexión IndexedDB
  let llave = null;       // llave maestra (CryptoKey)
  let usuarioActual = null;

  // Datos descifrados en memoria
  const datos = { persona: {}, parcela: {}, contrato: {}, portafolio: {}, archivo: {} };

  function abrirBD(usuario) {
    return new Promise((resolver, rechazar) => {
      const req = indexedDB.open('portafolios__' + usuario, 1);
      req.onupgradeneeded = () => {
        const bd = req.result;
        bd.createObjectStore('meta', { keyPath: 'id' });
        bd.createObjectStore('registros', { keyPath: 'id' });
        bd.createObjectStore('archivos', { keyPath: 'id' });
      };
      req.onsuccess = () => resolver(req.result);
      req.onerror = () => rechazar(req.error);
    });
  }

  function tx(tabla, modo, fn) {
    return new Promise((resolver, rechazar) => {
      const t = db.transaction(tabla, modo);
      const tienda = t.objectStore(tabla);
      let resultado;
      const r = fn(tienda);
      if (r) r.onsuccess = () => { resultado = r.result; };
      t.oncomplete = () => resolver(resultado);
      t.onerror = () => rechazar(t.error);
      t.onabort = () => rechazar(t.error || new Error('Operación cancelada (¿sin espacio?)'));
    });
  }
  const leerTodo = (tabla) => tx(tabla, 'readonly', (s) => s.getAll());
  const leer = (tabla, id) => tx(tabla, 'readonly', (s) => s.get(id));
  const poner = (tabla, valor) => tx(tabla, 'readwrite', (s) => s.put(valor));
  const borrar = (tabla, id) => tx(tabla, 'readwrite', (s) => s.delete(id));

  /* ---------- Sesión ---------- */
  async function iniciar(usuario, password, sal) {
    db = await abrirBD(usuario);
    usuarioActual = usuario;
    const kek = await C.llaveDeContrasena(password, sal);
    const meta = (await leer('meta', 'llaves')) || { id: 'llaves', envueltas: [] };
    llave = null;
    for (const env of meta.envueltas) {
      try { llave = await C.desenvolverLlave(env, kek); break; } catch (e) { /* probar la siguiente */ }
    }
    if (!llave) {
      if (meta.envueltas.length) throw new Error('No se pudo abrir la información guardada con esta contraseña.');
      llave = await C.nuevaLlaveMaestra();
      meta.envueltas.push(await C.envolverLlave(llave, kek));
      await poner('meta', meta);
    }
    // Pide al navegador no borrar los datos (importante en iPhone)
    if (navigator.storage && navigator.storage.persist) { try { await navigator.storage.persist(); } catch (e) {} }
    await cargarRegistros();
  }

  async function cargarRegistros() {
    Object.keys(datos).forEach((k) => { datos[k] = {}; });
    const regs = await leerTodo('registros');
    for (const r of regs) {
      try {
        const obj = await C.descifrarJSON(llave, r.iv, r.ct);
        if (!datos[r.tipo]) datos[r.tipo] = {};
        datos[r.tipo][r.id] = obj;
      } catch (e) { console.warn('Registro no se pudo descifrar', r.id); }
    }
  }

  function cerrar() {
    if (db) db.close();
    db = null; llave = null; usuarioActual = null;
    Object.keys(datos).forEach((k) => { datos[k] = {}; });
  }

  // Agrega la contraseña nueva como otra forma de abrir la llave maestra
  async function agregarContrasena(passwordNueva, sal) {
    const kek = await C.llaveDeContrasena(passwordNueva, sal);
    const meta = (await leer('meta', 'llaves')) || { id: 'llaves', envueltas: [] };
    meta.envueltas.push(await C.envolverLlave(llave, kek));
    await poner('meta', meta);
  }

  /* ---------- Registros ---------- */
  function nuevoId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  async function guardar(tipo, obj) {
    if (!obj.id) obj.id = nuevoId();
    obj.actualizado = new Date().toISOString();
    if (!obj.creado) obj.creado = obj.actualizado;
    const c = await C.cifrarJSON(llave, obj);
    await poner('registros', { id: obj.id, tipo, iv: c.iv, ct: c.ct });
    datos[tipo][obj.id] = obj;
    return obj;
  }

  async function eliminar(tipo, id) {
    await borrar('registros', id);
    delete datos[tipo][id];
  }

  const obtener = (tipo, id) => (id && datos[tipo] ? datos[tipo][id] || null : null);
  const lista = (tipo) => Object.values(datos[tipo] || {});

  /* ---------- Archivos (PDF y fotos) ---------- */
  async function guardarArchivo(bytes, nombre, mime) {
    const id = nuevoId();
    const c = await C.cifrarBytes(llave, bytes);
    await poner('archivos', { id, iv: c.iv, ct: c.ct });
    return guardar('archivo', { id, nombre, mime, tamano: bytes.byteLength });
  }

  async function leerArchivo(id) {
    const r = await leer('archivos', id);
    if (!r) return null;
    const meta = datos.archivo[id] || {};
    const bytes = await C.descifrarBytes(llave, r.iv, r.ct);
    return { bytes, nombre: meta.nombre || 'archivo', mime: meta.mime || 'application/octet-stream' };
  }

  async function eliminarArchivo(id) {
    if (!id) return;
    await borrar('archivos', id);
    await eliminar('archivo', id);
  }

  /* ---------- Respaldo ----------
     Formato del archivo .respaldo:
       "PORTAFOLIOS-RESPALDO-1\n" + 4 bytes (largo del encabezado) +
       encabezado JSON + contenido de archivos uno tras otro.
     Todo va cifrado; para abrirlo se necesita la contraseña del usuario. */
  const FIRMA = 'PORTAFOLIOS-RESPALDO-1\n';

  async function exportarRespaldo() {
    const meta = await leer('meta', 'llaves');
    const regs = await leerTodo('registros');
    const archs = await leerTodo('archivos');
    const enc = {
      version: 1, usuario: usuarioActual, fecha: new Date().toISOString(),
      llaves: meta.envueltas,
      registros: regs.map((r) => ({ id: r.id, tipo: r.tipo, iv: C.aB64(r.iv), ct: C.aB64(r.ct) })),
      archivos: archs.map((a) => ({ id: a.id, iv: C.aB64(a.iv), tam: a.ct.byteLength }))
    };
    const encBytes = new TextEncoder().encode(JSON.stringify(enc));
    const largo = new Uint8Array(4);
    new DataView(largo.buffer).setUint32(0, encBytes.length);
    const partes = [new TextEncoder().encode(FIRMA), largo, encBytes].concat(archs.map((a) => a.ct));
    return new Blob(partes, { type: 'application/octet-stream' });
  }

  // Importa un respaldo. Los datos se agregan (si ya existen, se reemplazan por los del respaldo).
  async function importarRespaldo(buffer, password, sal) {
    const u8 = new Uint8Array(buffer);
    const firma = new TextDecoder().decode(u8.subarray(0, FIRMA.length));
    if (firma !== FIRMA) throw new Error('Este archivo no es un respaldo de la app.');
    let pos = FIRMA.length;
    const largo = new DataView(u8.buffer, u8.byteOffset + pos, 4).getUint32(0);
    pos += 4;
    const enc = JSON.parse(new TextDecoder().decode(u8.subarray(pos, pos + largo)));
    pos += largo;

    // Abrir la llave maestra del respaldo con la contraseña
    const kek = await C.llaveDeContrasena(password, sal);
    let llaveResp = null;
    for (const env of enc.llaves) {
      try { llaveResp = await C.desenvolverLlave(env, kek); break; } catch (e) {}
    }
    if (!llaveResp) throw new Error('El respaldo se hizo con otro usuario o con otra contraseña.');

    let n = 0;
    for (const r of enc.registros) {
      const obj = await C.descifrarJSON(llaveResp, C.deB64(r.iv), C.deB64(r.ct));
      const c = await C.cifrarJSON(llave, obj);
      await poner('registros', { id: r.id, tipo: r.tipo, iv: c.iv, ct: c.ct });
      n++;
    }
    for (const a of enc.archivos) {
      const ct = u8.slice(pos, pos + a.tam);
      pos += a.tam;
      const bytes = await C.descifrarBytes(llaveResp, C.deB64(a.iv), ct);
      const c = await C.cifrarBytes(llave, bytes);
      await poner('archivos', { id: a.id, iv: c.iv, ct: c.ct });
    }
    await cargarRegistros();
    return { registros: n, archivos: enc.archivos.length, fecha: enc.fecha };
  }

  async function espacioUsado() {
    if (navigator.storage && navigator.storage.estimate) {
      const e = await navigator.storage.estimate();
      const persistente = navigator.storage.persisted ? await navigator.storage.persisted() : false;
      return { usado: e.usage, cuota: e.quota, persistente };
    }
    return null;
  }

  global.Almacen = {
    iniciar, cerrar, agregarContrasena, guardar, eliminar, obtener, lista, nuevoId,
    guardarArchivo, leerArchivo, eliminarArchivo, exportarRespaldo, importarRespaldo, espacioUsado,
    get usuario() { return usuarioActual; }
  };
})(window);
