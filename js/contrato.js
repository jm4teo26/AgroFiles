/* =========================================================================
   contrato.js — Genera el CONTRATO PRIVADO DE ARRENDAMIENTO en PDF.
   El texto es idéntico al formato final entregado por el usuario.
   Las partes que cambian van en negritas y subrayadas, como en el formato.

   Para cambiar la redacción del contrato, edita la función armarParrafos().
   Cada párrafo es una lista de pedazos de texto:
       T('texto normal')   N('negritas')   NS('negritas y subrayado')
   ========================================================================= */
(function (global) {
  'use strict';

  // Espacio mínimo entre palabras (en mayúsculas el espacio normal de Times se ve muy junto)
  const ESPACIO_PALABRAS = 0.3;

  const T = (t) => ({ t, b: false, u: false });   // texto normal
  const N = (t) => ({ t, b: true, u: false });    // negritas
  const NS = (t) => ({ t, b: true, u: true });    // negritas + subrayado

  const may = (s) => String(s || '').trim().toUpperCase();

  /* ---------------------------------------------------------------------
     TEXTO DEL CONTRATO
     d = datos capturados en la app (ver docs/TECNICO.md)
     --------------------------------------------------------------------- */
  function armarParrafos(d) {
    const Nn = global.Numeros;
    const senor = d.parceleroSexo === 'M' ? 'LA SEÑORA' : 'EL SEÑOR';
    const ciclo = may(d.ciclo);
    const anios = Number(d.duracionAnios);
    const aniosTxt = `${anios} ${anios === 1 ? 'AÑO' : 'AÑOS'}`;
    const monto = `${Nn.formatoMoneda(d.monto)} = SON: ${Nn.cantidadConLetra(d.monto)}`;
    const col = d.colindancias || {};
    const punto = (s) => { s = may(s); return s && !s.endsWith('.') ? s + '.' : s; };

    return [
      { pedazos: [T(`CONTRATO PRIVADO DE ARRENDAMIENTO QUE CELEBRAN POR UNA PARTE ${senor} `),
        NS(may(d.parceleroNombre)),
        T(' A QUIEN EN LO SUCESIVO SE LE DENOMINARÁ EL PARCELERO Y POR LA OTRA PARTE '),
        NS(may(d.inversionistaNombre)),
        T('  A QUIEN EN LO SUCESIVO SE LE DENOMINARÁ EL INVERSIONISTA. AMBAS PARTES CELEBRAN EL PRESENTE CONTRATO DE ARRENDAMIENTO AL TENOR DE LAS SIGUIENTES DECLARACIONES.')] },

      { pedazos: [N('PRIMERA-.'), T(' DECLARA EL PARCELERO QUE POSEE UNA FRACCION DE TERRENO DE '),
        NS(`${may(d.hectareas)} HECTÁREAS`), T(' UBICADAS EN '), NS(`EJIDO ${may(d.ejido)}.`)] },

      { pedazos: [N('SEGUNDA-.'), T(' SIGUE DECLARANDO EL PARCELERO, QUE POR ASI CONVENIR A SUS INTERESES, DESEA OTORGAR EN USO SU PARCELA – TERRENO A FAVOR DEL INVERSIONISTA POR EL CICLO '),
        NS(ciclo), T(' PARA QUE REALICE LA SIEMBRA DE '), NS(may(d.cultivo)),
        T(' O EL CULTIVO QUE SE CONSIDERE PRUDENTE, RECIBIENDO A CAMBIO LA CANTIDAD DE: '), NS(monto)] },

      { pedazos: [N('TERCERA-.'), T(' EL INVERSIONISTA DECLARA QUE ACEPTA TOMAR EN USUFRUCTO LA FRACCION DE TERRENO REFERIDA POR EL CICLO '),
        NS(ciclo), T(' POR ASI CONVENIR A SUS INTERESES.')] },

      { pedazos: [N('CUARTA-.'), T(' EL INVERSIONISTA SE COMPROMETE A ENTREGAR LA PARCELA A SU DUEÑO DESPUES DE COSECHAR EL CULTIVO DEL CICLO REFERIDO, NO ANTES.')] },

      { pedazos: [N('QUINTA-.'), T(' DECLARA EL PARCELERO QUE ADQUIERE EL COMPROMISO LEGAL CON EL INVERSIONISTA DE NO COMPROMETER EL USO DE LA PARCELA CON NINGUNA OTRA PERSONA FISICA O MORAL BAJO NINGUNA CIRCUNSTANCIA PARA EL CICLO '),
        NS(ciclo), T(' EN EL ENTENDIDO DE QUE SI EL PARCELERO '), N('INCUMPLE'),
        T(' LO ANTERIOR, ESTE INDEMNIZARA AL INVERSIONISTA CON TODOS LOS DAÑOS Y PERJUICIOS QUE PUDIERA SUFRIR, PREVIA INTERVENCIÓN DE LAS AUTORIDADES COMPETENTES SEGÚN CASO.')] },

      { pedazos: [N('SEXTA-.'), T(' DECLARA EL INVERSIONISTA QUE EN CASO DE SUFRIR PERDIDA Y NO PODER RECUPERAR LOS GASTOS EFECTUADOS, EL PARCELERO NO SE VERA AFECTADO POR ELLO SIENDO RESPONSABLE EL INVERSIONISTA DE LAS PERDIDAS QUE SE SUFRAN.')] },

      { pedazos: [N('SEPTIMA-.'), T(' DECLARA EL PARCELERO QUE LAS COLINDANCIAS DE SU PARCELA OBJETO DEL PRESENTE CONTRATO PRIVADO DE ARRENDAMIENTO, SON LAS SIGUIENTES.')], sinEspacioDespues: true },
      { pedazos: [T('AL NORTE-. ' + punto(col.norte))], izquierda: true, sinEspacioDespues: true },
      { pedazos: [T('AL SUR-. ' + punto(col.sur))], izquierda: true, sinEspacioDespues: true },
      { pedazos: [T('AL ESTE-. ' + punto(col.este))], izquierda: true, sinEspacioDespues: true },
      { pedazos: [T('AL OESTE-. ' + punto(col.oeste))], izquierda: true, espacioExtra: true },

      { pedazos: [N('OCTAVA-.'), T(' EL PARCELERO DECLARA QUE RECONOCE AL INVERSIONISTA COMO EL ENCARGADO DE LA ADMINISTRACIÓN DE LA PARCELA Y ES EL QUE APORTARA LOS RECURSOS FINANCIEROS PARA REALIZAR LA SIEMBRA, SIENDO EL INVERSIONISTA EL ÚNICO CON DERECHO A LAS POSIBLES UTILIDADES QUE SE PUDIERAN GENERAR.')] },

      { pedazos: [N('DURACIÓN.,'), T(' “EL ARRENDATARIO” TENDRA UNA DURACIÓN DE '), NS(aniosTxt),
        T(' QUE COMPRENDE '), NS(Nn.fechaGuiones(d.fechaInicio)), T(' AL '), NS(Nn.fechaGuiones(d.fechaFin) + '.')] },

      { pedazos: [T('SE SUSCRIBE EL PRESENTE CONTRATO PRIVADO DE ARRENDAMIENTO DE TERRENO AGRÍCOLA PARA QUE SIRVA COMO FUENTE DE INFORMACIÓN EN POSIBLES FUTURAS ACLARACIONES ESTAMPANDO AL CALCE PARA SU CONSTANCIA LAS FIRMAS DE LAS PERSONAS QUE EN ÉL INTERVINIERON.')] },

      { pedazos: [N('EJIDO '), NS(`${may(d.lugarEjido)}, ${may(d.municipio)}, ${may(d.estado)}, A ${Nn.fechaLarga(d.fechaFirma)}.`)], izquierda: true }
    ];
  }

  /* ---------------------------------------------------------------------
     MOTOR DE ACOMODO DE TEXTO (justificado, negritas, subrayado)
     --------------------------------------------------------------------- */
  // Parte cada pedazo en palabras que conservan su estilo.
  function palabras(pedazos) {
    const lista = [];
    pedazos.forEach((p) => {
      // Respeta espacios: separa en palabras; marca si iba pegada a la anterior
      const partes = p.t.split(/( +)/);
      partes.forEach((s) => {
        if (s === '') return;
        if (/^ +$/.test(s)) { lista.push({ espacio: true, b: p.b, u: p.u }); return; }
        lista.push({ t: s, b: p.b, u: p.u });
      });
    });
    // Junta palabras pegadas (sin espacio entre pedazos) en "grupos" que no se separan
    const grupos = [];
    let actual = null;
    let espacioAntes = null;
    lista.forEach((w) => {
      if (w.espacio) { espacioAntes = w; actual = null; return; }
      if (!actual) {
        actual = { trozos: [], espacioAntes: espacioAntes };
        grupos.push(actual);
        espacioAntes = null;
      }
      actual.trozos.push(w);
    });
    return grupos;
  }

  function anchoGrupo(g, f, tam) {
    return g.trozos.reduce((s, w) => s + (w.b ? f.negrita : f.normal).widthOfTextAtSize(w.t, tam), 0);
  }

  function partirEnLineas(grupos, f, tam, anchoMax) {
    const espacio = tam * ESPACIO_PALABRAS;
    const lineas = [];
    let linea = [], ancho = 0;
    grupos.forEach((g) => {
      const w = anchoGrupo(g, f, tam);
      const extra = linea.length ? espacio : 0;
      if (linea.length && ancho + extra + w > anchoMax) {
        lineas.push({ grupos: linea, ancho });
        linea = []; ancho = 0;
      }
      ancho += (linea.length ? espacio : 0) + w;
      linea.push(g);
    });
    if (linea.length) lineas.push({ grupos: linea, ancho });
    return lineas;
  }

  function dibujarLinea(pagina, linea, x0, y, f, tam, anchoMax, justificar, rgb) {
    const espacio = tam * ESPACIO_PALABRAS;
    const huecos = linea.grupos.length - 1;
    const espacioReal = justificar && huecos > 0 ? espacio + (anchoMax - linea.ancho) / huecos : espacio;
    let x = x0;
    linea.grupos.forEach((g, i) => {
      if (i > 0) {
        // Subraya el espacio si las dos palabras vecinas van subrayadas
        const prev = linea.grupos[i - 1];
        const ultimo = prev.trozos[prev.trozos.length - 1];
        if (ultimo.u && g.trozos[0].u) {
          pagina.drawLine({ start: { x, y: y - 1.6 }, end: { x: x + espacioReal, y: y - 1.6 }, thickness: 0.6, color: rgb(0, 0, 0) });
        }
        x += espacioReal;
      }
      g.trozos.forEach((w) => {
        const fuente = w.b ? f.negrita : f.normal;
        const ancho = fuente.widthOfTextAtSize(w.t, tam);
        pagina.drawText(w.t, { x, y, size: tam, font: fuente, color: rgb(0, 0, 0) });
        if (w.u) pagina.drawLine({ start: { x, y: y - 1.6 }, end: { x: x + ancho, y: y - 1.6 }, thickness: 0.6, color: rgb(0, 0, 0) });
        x += ancho;
      });
    });
  }

  /* ---------------------------------------------------------------------
     GENERAR PDF  (tamaño carta, 1 hoja)
     --------------------------------------------------------------------- */
  // fuentes = { fontkit, normal: bytes TTF, negrita: bytes TTF }
  // Se incrusta la letra Liberation Serif (igual de ancho que Times New Roman)
  // para que el contrato se vea idéntico en cualquier celular o computadora.
  async function generarContratoPDF(datos, PDFLib, fuentes) {
    const { PDFDocument, StandardFonts, rgb } = PDFLib;
    const doc = await PDFDocument.create();
    doc.setTitle('CONTRATO - ' + may(datos.parceleroNombre));
    doc.setCreator('Portafolios Agrícolas');
    let f;
    if (fuentes && fuentes.fontkit) {
      doc.registerFontkit(fuentes.fontkit);
      f = {
        normal: await doc.embedFont(fuentes.normal, { subset: true }),
        negrita: await doc.embedFont(fuentes.negrita, { subset: true })
      };
    } else {
      f = {
        normal: await doc.embedFont(StandardFonts.TimesRoman),
        negrita: await doc.embedFont(StandardFonts.TimesRomanBold)
      };
    }
    const ANCHO = 612, ALTO = 792, MARGEN = 36;
    const anchoTexto = ANCHO - MARGEN * 2;
    const LIMITE_FIRMAS = 175; // el texto no debe bajar de aquí (zona de firmas)
    const parrafos = armarParrafos(datos);

    // Si el texto no cabe (colindancias muy largas), reduce un poco la letra.
    let tam = 8.8;
    let plan;
    for (; tam >= 7.5; tam -= 0.2) {
      plan = planear(parrafos, f, tam, anchoTexto);
      if (ALTO - 62 - plan.alto >= LIMITE_FIRMAS) break;
    }
    const interlineado = tam * 1.45;

    const pagina = doc.addPage([ANCHO, ALTO]);

    // Título
    const titulo = 'CONTRATO PRIVADO DE ARRENDAMIENTO';
    const tamT = tam + 0.4;
    const wT = f.negrita.widthOfTextAtSize(titulo, tamT);
    const yT = ALTO - 42;
    pagina.drawText(titulo, { x: (ANCHO - wT) / 2, y: yT, size: tamT, font: f.negrita });
    pagina.drawLine({ start: { x: (ANCHO - wT) / 2, y: yT - 1.6 }, end: { x: (ANCHO + wT) / 2, y: yT - 1.6 }, thickness: 0.6 });

    let y = ALTO - 66;
    plan.parrafos.forEach((p) => {
      p.lineas.forEach((l, i) => {
        const ultima = i === p.lineas.length - 1;
        dibujarLinea(pagina, l, MARGEN, y, f, tam, anchoTexto, !p.izquierda && !ultima, rgb);
        y -= interlineado;
      });
      if (!p.sinEspacioDespues) y -= tam * 0.75;
      if (p.espacioExtra) y -= tam * 0.6;
    });

    // Firmas
    const gris = rgb(0.55, 0.55, 0.55);
    const firma = (x1, x2, yLinea, etiqueta) => {
      pagina.drawLine({ start: { x: x1, y: yLinea }, end: { x: x2, y: yLinea }, thickness: 0.5, color: gris });
      const tamE = 7.2;
      const w = f.negrita.widthOfTextAtSize(etiqueta, tamE);
      pagina.drawText(etiqueta, { x: (x1 + x2 - w) / 2, y: yLinea - 11, size: tamE, font: f.negrita });
    };
    firma(99, 241, 143, 'EL PARCELERO');
    firma(370, 512, 143, 'EL INVERSIONISTA');
    firma(99, 241, 53, 'TESTIGO');
    firma(370, 512, 53, 'TESTIGO');

    return await doc.save();
  }

  function planear(parrafos, f, tam, anchoTexto) {
    const interlineado = tam * 1.45;
    let alto = 0;
    const lista = parrafos.map((p) => {
      const lineas = partirEnLineas(palabras(p.pedazos), f, tam, anchoTexto);
      alto += lineas.length * interlineado;
      if (!p.sinEspacioDespues) alto += tam * 0.75;
      if (p.espacioExtra) alto += tam * 0.6;
      return Object.assign({}, p, { lineas });
    });
    return { parrafos: lista, alto };
  }

  global.Contrato = { generarContratoPDF, armarParrafos };
})(typeof window !== 'undefined' ? window : globalThis);
