/* =========================================================================
   numeros.js — Convierte cantidades a letra y da formato a fechas.
   Ejemplo: cantidadConLetra(180000) -> "CIENTO OCHENTA MIL PESOS 00/100 M.N."
   ========================================================================= */
(function (global) {
  'use strict';

  const UNIDADES = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE',
    'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE',
    'VEINTE', 'VEINTIÚN', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS',
    'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE'];
  const DECENAS = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
  const CENTENAS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS',
    'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

  // Convierte un número de 0 a 999 a letra.
  function hasta999(n) {
    if (n === 0) return '';
    if (n === 100) return 'CIEN';
    const c = Math.floor(n / 100);
    const r = n % 100;
    let texto = CENTENAS[c];
    if (r > 0) {
      let resto;
      if (r < 30) resto = UNIDADES[r];
      else {
        const d = Math.floor(r / 10), u = r % 10;
        resto = DECENAS[d] + (u ? ' Y ' + UNIDADES[u] : '');
      }
      texto = (texto ? texto + ' ' : '') + resto;
    }
    return texto;
  }

  // Convierte un entero (hasta 999,999,999,999) a letra.
  function enteroALetras(n) {
    n = Math.floor(n);
    if (n === 0) return 'CERO';
    const millones = Math.floor(n / 1e6);
    const miles = Math.floor((n % 1e6) / 1000);
    const resto = n % 1000;
    const partes = [];
    if (millones) {
      partes.push(millones === 1 ? 'UN MILLÓN' : enteroALetras(millones) + ' MILLONES');
    }
    if (miles) partes.push(miles === 1 ? 'MIL' : hasta999(miles) + ' MIL');
    if (resto) partes.push(hasta999(resto));
    return partes.join(' ');
  }

  // "CIENTO OCHENTA MIL PESOS 00/100 M.N."
  function cantidadConLetra(monto) {
    const total = Math.round(Number(monto) * 100);
    const pesos = Math.floor(total / 100);
    const centavos = total % 100;
    let letras = enteroALetras(pesos);
    // "UN MILLÓN DE PESOS", "DOS MILLONES DE PESOS" cuando no hay miles ni unidades
    if (pesos >= 1e6 && pesos % 1e6 === 0) letras += ' DE';
    const nombre = pesos === 1 ? 'PESO' : 'PESOS';
    return `${letras} ${nombre} ${String(centavos).padStart(2, '0')}/100 M.N.`;
  }

  // "$180,000" (agrega centavos solo si los hay)
  function formatoMoneda(monto) {
    const n = Number(monto);
    const tieneCentavos = Math.round(n * 100) % 100 !== 0;
    return '$' + n.toLocaleString('en-US', {
      minimumFractionDigits: tieneCentavos ? 2 : 0,
      maximumFractionDigits: 2
    });
  }

  const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO',
    'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

  // Recibe "2026-09-01" y regresa {dia:"01", mes:"SEPTIEMBRE", anio:"2026"}
  function partesFecha(iso) {
    const [a, m, d] = String(iso).split('-');
    return { dia: d, mes: MESES[Number(m) - 1], anio: a };
  }
  // "01 – SEPTIEMBRE – 2026"
  function fechaGuiones(iso) {
    const p = partesFecha(iso);
    return `${p.dia} – ${p.mes} – ${p.anio}`;
  }
  // "01 DE SEPTIEMBRE DE 2026"
  function fechaLarga(iso) {
    const p = partesFecha(iso);
    return `${p.dia} DE ${p.mes} DE ${p.anio}`;
  }

  global.Numeros = { enteroALetras, cantidadConLetra, formatoMoneda, fechaGuiones, fechaLarga, MESES };
})(typeof window !== 'undefined' ? window : globalThis);
