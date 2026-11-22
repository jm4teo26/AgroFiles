/* =========================================================================
   editor.js — Editor de fotos: girar, recortar, brillo, contraste, B/N.
   Uso:  const r = await Editor.abrir(bytes, mime);   // r = {bytes, mime} o null
   ========================================================================= */
(function (global) {
  'use strict';
  const MAXIMO = 2400; // lado más largo de la foto guardada (px)

  function cargarImagen(bytes, mime) {
    return new Promise((resolver, rechazar) => {
      const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolver(img); };
      img.onerror = () => { URL.revokeObjectURL(url); rechazar(new Error('No se pudo abrir la imagen. Prueba con una foto JPG o PNG.')); };
      img.src = url;
    });
  }

  function abrir(bytes, mime) {
    return new Promise(async (resolver) => {
      let img;
      try { img = await cargarImagen(bytes, mime); }
      catch (e) { alert(e.message); resolver(null); return; }

      const est = { giro: 0, recorte: null, brillo: 0, contraste: 0, bn: false, modoRecorte: false };
      const fondo = document.createElement('div');
      fondo.className = 'modal-fondo editor';
      fondo.innerHTML = `
        <div class="modal editor-caja">
          <div class="editor-lienzo"><canvas></canvas></div>
          <div class="editor-herramientas">
            <div class="fila">
              <button type="button" data-a="izq" title="Girar a la izquierda">⟲ Girar</button>
              <button type="button" data-a="der" title="Girar a la derecha">Girar ⟳</button>
              <button type="button" data-a="recortar">✂ Recortar</button>
              <button type="button" data-a="sinrecorte">Quitar recorte</button>
              <button type="button" data-a="bn">Blanco y negro</button>
            </div>
            <label>Brillo <input type="range" min="-100" max="100" value="0" data-r="brillo"></label>
            <label>Contraste <input type="range" min="-100" max="100" value="0" data-r="contraste"></label>
            <p class="ayuda" data-ayuda></p>
            <div class="fila fin">
              <button type="button" data-a="cancelar" class="sec">Cancelar</button>
              <button type="button" data-a="guardar" class="prim">Guardar foto</button>
            </div>
          </div>
        </div>`;
      document.body.appendChild(fondo);
      const lienzo = fondo.querySelector('canvas');
      const ctx = lienzo.getContext('2d');
      const ayuda = fondo.querySelector('[data-ayuda]');

      // Imagen girada en un canvas aparte (tamaño reducido a MAXIMO)
      let girada = document.createElement('canvas');
      function prepararGirada() {
        const esc = Math.min(1, MAXIMO / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.round(img.naturalWidth * esc), h = Math.round(img.naturalHeight * esc);
        const vertical = est.giro % 180 !== 0;
        girada.width = vertical ? h : w;
        girada.height = vertical ? w : h;
        const g = girada.getContext('2d');
        g.save();
        g.translate(girada.width / 2, girada.height / 2);
        g.rotate(est.giro * Math.PI / 180);
        g.drawImage(img, -w / 2, -h / 2, w, h);
        g.restore();
      }

      let escalaVista = 1;
      function dibujar() {
        const caja = fondo.querySelector('.editor-lienzo');
        const maxW = caja.clientWidth - 8, maxH = caja.clientHeight - 8;
        escalaVista = Math.min(maxW / girada.width, maxH / girada.height, 1);
        lienzo.width = Math.round(girada.width * escalaVista);
        lienzo.height = Math.round(girada.height * escalaVista);
        ctx.drawImage(girada, 0, 0, lienzo.width, lienzo.height);
        // Vista previa de brillo/contraste/BN con filtro CSS
        lienzo.style.filter = `brightness(${1 + est.brillo / 100}) contrast(${1 + est.contraste / 100})` + (est.bn ? ' grayscale(1)' : '');
        const r = est.recorte;
        if (r) {
          ctx.fillStyle = 'rgba(0,0,0,0.5)';
          const x = r.x * lienzo.width, y = r.y * lienzo.height, w = r.w * lienzo.width, h = r.h * lienzo.height;
          ctx.fillRect(0, 0, lienzo.width, y);
          ctx.fillRect(0, y + h, lienzo.width, lienzo.height - y - h);
          ctx.fillRect(0, y, x, h);
          ctx.fillRect(x + w, y, lienzo.width - x - w, h);
          ctx.strokeStyle = '#ffd400'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
        }
        ayuda.textContent = est.modoRecorte
          ? 'Arrastra el dedo o el mouse sobre la foto para marcar el área que quieres conservar.'
          : '';
        fondo.querySelector('[data-a="recortar"]').classList.toggle('activo', est.modoRecorte);
        fondo.querySelector('[data-a="bn"]').classList.toggle('activo', est.bn);
      }

      // Recorte con el dedo o el mouse
      let inicio = null;
      const punto = (ev) => {
        const b = lienzo.getBoundingClientRect();
        return { x: Math.min(1, Math.max(0, (ev.clientX - b.left) / b.width)), y: Math.min(1, Math.max(0, (ev.clientY - b.top) / b.height)) };
      };
      lienzo.addEventListener('pointerdown', (ev) => {
        if (!est.modoRecorte) return;
        ev.preventDefault();
        lienzo.setPointerCapture(ev.pointerId);
        inicio = punto(ev);
      });
      lienzo.addEventListener('pointermove', (ev) => {
        if (!inicio) return;
        const p = punto(ev);
        est.recorte = { x: Math.min(inicio.x, p.x), y: Math.min(inicio.y, p.y), w: Math.abs(p.x - inicio.x), h: Math.abs(p.y - inicio.y) };
        dibujar();
      });
      lienzo.addEventListener('pointerup', () => {
        inicio = null;
        if (est.recorte && (est.recorte.w < 0.03 || est.recorte.h < 0.03)) est.recorte = null;
        est.modoRecorte = false;
        dibujar();
      });

      // Al girar, el recorte también se gira
      function girarRecorte(sentido) {
        const r = est.recorte;
        if (!r) return;
        est.recorte = sentido > 0
          ? { x: 1 - r.y - r.h, y: r.x, w: r.h, h: r.w }
          : { x: r.y, y: 1 - r.x - r.w, w: r.h, h: r.w };
      }

      fondo.querySelectorAll('input[type=range]').forEach((inp) => {
        inp.addEventListener('input', () => { est[inp.dataset.r] = Number(inp.value); dibujar(); });
      });

      function terminar(resultado) {
        fondo.remove();
        window.removeEventListener('resize', dibujar);
        resolver(resultado);
      }

      fondo.addEventListener('click', async (ev) => {
        const a = ev.target.closest('[data-a]');
        if (!a) return;
        const accion = a.dataset.a;
        if (accion === 'izq' || accion === 'der') {
          const s = accion === 'der' ? 1 : -1;
          est.giro = (est.giro + 90 * s + 360) % 360;
          girarRecorte(s);
          prepararGirada(); dibujar();
        } else if (accion === 'recortar') { est.modoRecorte = !est.modoRecorte; dibujar(); }
        else if (accion === 'sinrecorte') { est.recorte = null; dibujar(); }
        else if (accion === 'bn') { est.bn = !est.bn; dibujar(); }
        else if (accion === 'cancelar') terminar(null);
        else if (accion === 'guardar') {
          a.disabled = true; a.textContent = 'Guardando…';
          terminar(await exportar());
        }
      });

      async function exportar() {
        const r = est.recorte || { x: 0, y: 0, w: 1, h: 1 };
        const sx = Math.round(r.x * girada.width), sy = Math.round(r.y * girada.height);
        const sw = Math.max(1, Math.round(r.w * girada.width)), sh = Math.max(1, Math.round(r.h * girada.height));
        const out = document.createElement('canvas');
        out.width = sw; out.height = sh;
        const o = out.getContext('2d');
        o.fillStyle = '#fff'; o.fillRect(0, 0, sw, sh);
        o.drawImage(girada, sx, sy, sw, sh, 0, 0, sw, sh);
        if (est.brillo || est.contraste || est.bn) {
          // Se aplica pixel por pixel (funciona igual en todos los navegadores)
          const im = o.getImageData(0, 0, sw, sh);
          const d = im.data;
          const br = est.brillo * 2.55;
          const c = est.contraste * 2.55;
          const f = (259 * (c + 255)) / (255 * (259 - c));
          for (let i = 0; i < d.length; i += 4) {
            let rr = d[i], gg = d[i + 1], bb = d[i + 2];
            if (est.bn) { const y = 0.299 * rr + 0.587 * gg + 0.114 * bb; rr = gg = bb = y; }
            d[i] = f * (rr + br - 128) + 128;
            d[i + 1] = f * (gg + br - 128) + 128;
            d[i + 2] = f * (bb + br - 128) + 128;
          }
          o.putImageData(im, 0, 0);
        }
        const blob = await new Promise((res) => out.toBlob(res, 'image/jpeg', 0.85));
        return { bytes: new Uint8Array(await blob.arrayBuffer()), mime: 'image/jpeg' };
      }

      window.addEventListener('resize', dibujar);
      prepararGirada();
      requestAnimationFrame(dibujar);
    });
  }

  // Convierte cualquier imagen que el navegador pueda abrir a JPG (sin editar)
  async function normalizar(bytes, mime) {
    if (mime === 'image/jpeg' || mime === 'image/png') return { bytes, mime };
    const img = await cargarImagen(bytes, mime);
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.9));
    return { bytes: new Uint8Array(await blob.arrayBuffer()), mime: 'image/jpeg' };
  }

  global.Editor = { abrir, normalizar };
})(window);
