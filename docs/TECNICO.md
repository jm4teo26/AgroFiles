# Documentación técnica

## Por qué JavaScript y no Python

GitHub Pages solo sirve archivos estáticos: el navegador es quien ejecuta el programa, y los navegadores ejecutan JavaScript. Python se podría correr con Pyodide, pero pesa ~15 MB y es lento en celular. Por eso la app está hecha en **HTML + CSS + JavaScript sin frameworks**, con todo el código comentado en español.

## Estructura

| Archivo | Qué hace |
|---|---|
| `config.js` | Lista de usuarios (`window.USUARIOS`) y versión |
| `js/cripto.js` | Contraseñas (PBKDF2) y cifrado (AES-GCM 256) con Web Crypto |
| `js/almacen.js` | Guardado en IndexedDB, cifrado/descifrado, respaldo |
| `js/util.js` | Ventanas, avisos, fechas y **reglas de vencimiento** |
| `js/numeros.js` | Cantidad con letra y formato de fechas del contrato |
| `js/contrato.js` | **Texto del contrato** y armado del PDF |
| `js/pdfs.js` | Unir documentos, orden inverso, girar PDF, descargar/compartir |
| `js/editor.js` | Editor de fotos |
| `js/app.js` | Pantallas (personas, parcelas, contratos, portafolios, búsqueda, respaldo) |
| `sw.js` | Service worker: copia la app en el dispositivo para usarla sin internet |
| `lib/pdf-lib.min.js` | [pdf-lib](https://pdf-lib.js.org) 1.17.1 (MIT) |
| `lib/fontkit.umd.min.js` | @pdf-lib/fontkit 1.1.1 (MIT), para incrustar la letra |
| `fonts/` | Liberation Serif (SIL Open Font License), mismo ancho que Times New Roman |

## Cambios comunes

### Cambiar el texto del contrato

En `js/contrato.js`, función `armarParrafos(d)`. Cada párrafo es una lista de pedazos:

```js
T('texto normal')    N('negritas')    NS('negritas y subrayado')
```

Datos disponibles en `d`: `parceleroNombre`, `parceleroSexo` (`H`/`M`), `inversionistaNombre`, `hectareas`, `ejido`, `ciclo`, `cultivo`, `monto`, `colindancias.{norte,sur,este,oeste}`, `duracionAnios`, `fechaInicio`, `fechaFin`, `lugarEjido`, `municipio`, `estado`, `fechaFirma` (fechas `AAAA-MM-DD`).

Tamaño de letra: `let tam = 8.8` en `generarContratoPDF`. Si el texto no cabe arriba de las firmas, la letra se reduce sola (hasta 7.5). Posición de las firmas: llamadas a `firma(...)` al final.

### Cambiar cuánto dura un documento

En `js/util.js`, objeto `DOCS_PERSONA`:

```js
CSF:     { nombre: 'Constancia de situación fiscal', meses: 3 },
OPINION: { nombre: 'Opinión de cumplimiento (SAT)', dias: 30 },
INE:     { nombre: 'INE', venceAnio: true },
```

`DIAS_AVISO = 15` define cuántos días antes avisa. Para agregar otro tipo de documento por persona, agrégalo a este objeto (ej. `DOMICILIO: { nombre: 'Comprobante de domicilio', meses: 3 }`). Aparecerá en las personas y en las opciones al crear un portafolio.

### Cerrar sesión por inactividad

`MINUTOS_INACTIVO` en `js/app.js`.

### Publicar cambios

Después de cualquier cambio, sube `VERSION` en `sw.js`. Si agregas un archivo nuevo, agrégalo también a la lista `ARCHIVOS` de `sw.js`.

## Datos

### Dónde se guardan

IndexedDB del navegador, una base por usuario: `portafolios__<usuario>`, con tres tablas:

- `meta`: la llave maestra «envuelta» (cifrada) con la contraseña.
- `registros`: `{id, tipo, iv, ct}`. `ct` es el JSON del registro cifrado.
- `archivos`: `{id, iv, ct}`. `ct` es el PDF o la foto cifrada.

Un navegador no puede crear carpetas visibles en iPhone ni Android; por eso la «carpeta de la app» es este almacenamiento interno, y el **respaldo** es la forma de sacar los datos del dispositivo. Al entrar se pide `navigator.storage.persist()` para que el navegador no borre los datos cuando falte espacio.

### Tipos de registro

```text
persona    { nombre, sexo, cargo, curp, rfc, telefono, domicilio, notas,
             docs: { ACTA|CURP|INE|CSF|OPINION: { archivoId, subido, fecha?, vigencia? } } }
parcela    { propietarioId, numero, certificado, hectareas, ejido, municipio, estado,
             colindancias: {norte,sur,este,oeste}, docs: { CERTIFICADO|CARTA: { archivoId } } }
contrato   { parceleroId, inversionistaId, testigo1Id, testigo2Id, parcelaId, portafolioId?,
             hectareas, ejido, ciclo, cultivo, monto, colindancias, duracionAnios,
             fechaInicio, fechaFin, lugarEjido, municipio, estado, fechaFirma,
             generadoId, generadoFecha, firmadoId, firmadoFecha }
portafolio { agricultorId, ciclo, requeridos[], propiaIncluye[], rentaIncluye[],
             parcelas: [{ id, parcelaId, tenencia: 'propia'|'rentada', contratoId? }],
             orden[] (claves), excluidos[] (claves), extras: [{ id, nombre, archivoId }] }
archivo    { nombre, mime, tamano }   (el contenido está en la tabla «archivos»)
```

Todos llevan `id`, `creado` y `actualizado`.

Los documentos del portafolio **no se copian**: se calculan cada vez (`itemsPortafolio` en `app.js`) a partir de la persona, las parcelas y los contratos. Así, si renuevas la constancia de una persona, todos sus portafolios la usan de inmediato.

Claves de los documentos del portafolio (para el orden): `p:<TIPO>` (agricultor), `e:<entrada>:<PIEZA>` (parcela) y `x:<id>` (extras).

### Formato del respaldo

```text
"PORTAFOLIOS-RESPALDO-1\n" | 4 bytes: largo del encabezado | encabezado JSON | archivos cifrados uno tras otro
```

El encabezado trae las llaves envueltas, los registros cifrados (base64) y el tamaño de cada archivo. Al importar, se abre la llave maestra del respaldo con la contraseña y todo se vuelve a cifrar con la llave del dispositivo.

## Seguridad

- **Contraseñas**: en `config.js` solo hay `sal` y `verificador = PBKDF2-SHA256(contraseña, sal+":login", 310 000)`. Del verificador no se puede obtener la contraseña, salvo probando contraseñas una por una. Por eso conviene una contraseña larga.
- **Cifrado**: una llave maestra AES-GCM de 256 bits aleatoria cifra todos los datos. Esa llave se guarda envuelta con `PBKDF2(contraseña, sal+":datos")`, que es una derivación distinta del verificador.
- **Cambiar la contraseña** agrega una envoltura nueva de la misma llave maestra, sin volver a cifrar todo.
- **Límites que debes conocer**:
  - El código es público. El inicio de sesión en sí no protege nada: lo que protege los datos es el cifrado, y su fuerza depende de la contraseña.
  - Quien tenga el dispositivo **con la sesión abierta** puede ver los datos. La sesión se cierra a los 20 minutos sin uso.
  - Si se olvida la contraseña, no hay forma de recuperar los datos.
- La app necesita `https://` (GitHub Pages lo da), porque el navegador solo permite cifrar en conexiones seguras. Para pruebas en la computadora, `http://localhost` también funciona:

```bash
cd carpeta-de-la-app
python3 -m http.server 8000
# abrir http://localhost:8000
```

## Compatibilidad

Chrome/Edge 90+, Safari 15.4+ (iOS 15.4+), Firefox 100+. En iPhone hay que instalarla («Agregar a pantalla de inicio») para que los datos no se borren.
