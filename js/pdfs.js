/* =========================================================================
   pdfs.js — Une documentos en un solo PDF, convierte fotos en páginas
   y guarda/comparte archivos en el dispositivo.
   ========================================================================= */
(function (global) {
  'use strict';
  const CARTA = [612, 792];

  // Agrega una imagen (JPG o PNG) a una hoja carta, centrada y ajustada.
  async function agregarImagen(doc, bytes, mime) {
    const img = mime === 'image/png' ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
    const horizontal = img.width > img.height;
    const [w, h] = horizontal ? [CARTA[1], CARTA[0]] : CARTA;
    const pagina = doc.addPage([w, h]);
    const margen = 18;
    const escala = Math.min((w - margen * 2) / img.width, (h - margen * 2) / img.height);
    const iw = img.width * escala, ih = img.height * escala;
    pagina.drawImage(img, { x: (w - iw) / 2, y: (h - ih) / 2, width: iw, height: ih });
  }

  // items: [{ bytes, mime, titulo }]  ->  { bytes, errores: [] }
  async function unir(items, inverso) {
    const { PDFDocument } = global.PDFLib;
    const doc = await PDFDocument.create();
    const errores = [];
    for (const it of items) {
      try {
        if (it.mime === 'application/pdf') {
          const origen = await PDFDocument.load(it.bytes, { ignoreEncryption: true });
          const paginas = await doc.copyPages(origen, origen.getPageIndices());
          paginas.forEach((p) => doc.addPage(p));
        } else if (it.mime === 'image/jpeg' || it.mime === 'image/png') {
          await agregarImagen(doc, it.bytes, it.mime);
        } else {
          errores.push(`${it.titulo}: tipo de archivo no compatible`);
        }
      } catch (e) {
        errores.push(`${it.titulo}: no se pudo leer (${e.message})`);
      }
    }
    if (inverso) {
      const final = await PDFDocument.create();
      const idx = doc.getPageIndices().reverse();
      const paginas = await final.copyPages(doc, idx);
      paginas.forEach((p) => final.addPage(p));
      return { bytes: await final.save(), errores, paginas: idx.length };
    }
    return { bytes: await doc.save(), errores, paginas: doc.getPageCount() };
  }

  async function contarPaginas(bytes) {
    try {
      const d = await global.PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
      return d.getPageCount();
    } catch (e) { return null; }
  }

  // Gira todas las páginas de un PDF (grados: 90, -90, 180)
  async function girarPDF(bytes, grados) {
    const { PDFDocument, degrees } = global.PDFLib;
    const d = await PDFDocument.load(bytes, { ignoreEncryption: true });
    d.getPages().forEach((p) => p.setRotation(degrees((p.getRotation().angle + grados + 360) % 360)));
    return d.save();
  }

  const esCelular = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  // Descarga un archivo. En celular usa "Compartir" (para guardarlo en Archivos,
  // mandarlo por WhatsApp o imprimirlo); en computadora lo descarga directo.
  async function guardarEnDispositivo(bytes, nombre, mime) {
    const blob = new Blob([bytes], { type: mime });
    if (esCelular() && navigator.canShare) {
      const archivo = new File([blob], nombre, { type: mime });
      if (navigator.canShare({ files: [archivo] })) {
        try { await navigator.share({ files: [archivo], title: nombre }); return; }
        catch (e) { if (e.name === 'AbortError') return; }
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = nombre;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  // Abre un PDF en una pestaña nueva para verlo o imprimirlo
  function abrirParaImprimir(bytes, mime) {
    const url = URL.createObjectURL(new Blob([bytes], { type: mime || 'application/pdf' }));
    const w = window.open(url, '_blank');
    if (!w) location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 10 * 60000);
  }

  global.PDFs = { unir, contarPaginas, girarPDF, guardarEnDispositivo, abrirParaImprimir, esCelular };
})(window);
