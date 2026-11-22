/* =========================================================================
   cripto.js — Contraseñas y cifrado (AES-GCM 256 bits, Web Crypto API)

   Cómo funciona:
   1. En config.js cada usuario tiene una "sal" y un "verificador".
      El verificador sale de la contraseña, pero no se puede regresar a ella.
   2. Al entrar, se calcula el verificador con lo que escribiste y se compara.
   3. Con la contraseña se calcula otra llave (KEK) que abre la "llave maestra"
      guardada en el dispositivo. La llave maestra cifra todos los datos.
      Así, cambiar la contraseña no obliga a volver a cifrar todo.
   ========================================================================= */
(function (global) {
  'use strict';

  const ITERACIONES = 310000;
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  const aHex = (buf) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  const aB64 = (buf) => {
    const bytes = new Uint8Array(buf);
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  };
  const deB64 = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

  async function pbkdf2Bits(password, sal, proposito) {
    const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    return crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(sal + ':' + proposito), iterations: ITERACIONES },
      base, 256);
  }

  // Verificador que va en config.js
  async function calcularVerificador(password, sal) {
    return aHex(await pbkdf2Bits(password, sal, 'login'));
  }

  // Llave que "envuelve" (protege) a la llave maestra
  async function llaveDeContrasena(password, sal) {
    const bits = await pbkdf2Bits(password, sal, 'datos');
    return crypto.subtle.importKey('raw', bits, 'AES-GCM', false, ['encrypt', 'decrypt']);
  }

  // Llave maestra nueva (aleatoria)
  async function nuevaLlaveMaestra() {
    return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  }

  async function envolverLlave(maestra, kek) {
    const crudo = await crypto.subtle.exportKey('raw', maestra);
    const c = await cifrarBytes(kek, crudo);
    return { iv: aB64(c.iv), ct: aB64(c.ct) };
  }

  async function desenvolverLlave(envuelta, kek) {
    const crudo = await descifrarBytes(kek, deB64(envuelta.iv), deB64(envuelta.ct));
    return crypto.subtle.importKey('raw', crudo, 'AES-GCM', true, ['encrypt', 'decrypt']);
  }

  async function cifrarBytes(llave, bytes) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, llave, bytes);
    return { iv, ct: new Uint8Array(ct) };
  }

  async function descifrarBytes(llave, iv, ct) {
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, llave, ct));
  }

  async function cifrarJSON(llave, obj) {
    return cifrarBytes(llave, enc.encode(JSON.stringify(obj)));
  }

  async function descifrarJSON(llave, iv, ct) {
    return JSON.parse(dec.decode(await descifrarBytes(llave, iv, ct)));
  }

  function salAleatoria() {
    return aHex(crypto.getRandomValues(new Uint8Array(16)));
  }

  global.Cripto = {
    calcularVerificador, llaveDeContrasena, nuevaLlaveMaestra, envolverLlave, desenvolverLlave,
    cifrarBytes, descifrarBytes, cifrarJSON, descifrarJSON, salAleatoria, aB64, deB64
  };
})(typeof window !== 'undefined' ? window : globalThis);
