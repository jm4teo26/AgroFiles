# Portafolios Agrícolas

Aplicación para:

- **Hacer contratos privados de arrendamiento** de parcelas en PDF, con el mismo formato de siempre.
- **Guardar los documentos de cada persona** (acta, CURP, INE, constancia de situación fiscal, opinión de cumplimiento) **una sola vez** y reutilizarlos.
- **Armar portafolios por ciclo agrícola**: la app junta sola los documentos del agricultor, de sus parcelas propias y de las rentadas (contrato + 4 INE + certificado del dueño).
- **Avisar** qué falta y qué está vencido (constancia > 3 meses, opinión > 30 días, INE vencida).
- **Descargar el portafolio en un solo PDF**, en orden o en **orden inverso** para que al imprimir quede acomodado.

Funciona en **Android, iPhone/iPad, Windows y Mac**, **sin internet** y **sin base de datos en línea**: la información se guarda **cifrada** en cada dispositivo.

| Documento | Para qué |
|---|---|
| [docs/MANUAL.md](docs/MANUAL.md) | Cómo usar la app día a día |
| [docs/TECNICO.md](docs/TECNICO.md) | Cómo está hecha, cómo cambiar el contrato, seguridad |

---

## 1. Publicarla en GitHub Pages (una sola vez)

1. Crea una cuenta en [github.com](https://github.com) si no tienes.
2. Arriba a la derecha: **+ → New repository**.
   - Nombre: por ejemplo `portafolios`.
   - Déjalo **Public** (GitHub Pages gratis solo funciona con repositorios públicos; tus datos **no** se suben, solo el programa).
   - Crea el repositorio.
3. En el repositorio nuevo: **Add file → Upload files**. Arrastra **todo el contenido** de esta carpeta (no la carpeta, sino lo que tiene adentro: `index.html`, `js/`, `lib/`, etc.) y presiona **Commit changes**.
4. Ve a **Settings → Pages**. En *Source* elige **Deploy from a branch**, rama **main**, carpeta **/ (root)** y guarda.
5. En uno o dos minutos aparecerá la dirección, algo como:
   `https://TU-USUARIO.github.io/portafolios/`

Esa es la dirección de tu app. Ábrela en cada dispositivo.

## 2. Cambiar la contraseña del administrador (antes de usarla en serio)

El usuario inicial es **`admin`** con la contraseña temporal **`Cambiar-2026`**.

1. Abre `https://TU-USUARIO.github.io/portafolios/generar-usuario.html`.
2. Usuario: `admin`, nombre: el tuyo, y tu contraseña nueva.
3. Copia la línea que te da.
4. En GitHub abre `config.js` → ícono del lápiz ✏️ → reemplaza la línea de `admin` por la nueva → **Commit changes**.
5. Abre `sw.js`, cambia `VERSION = 'v1.0.0'` a `'v1.0.1'` (o cualquier número nuevo) y guarda. Esto hace que los dispositivos tomen el cambio.

> Hazlo **antes** de guardar información real. Si ya guardaste información, mejor cambia la contraseña desde la app: **Respaldo → Cambiar contraseña** (ver el manual).

Para **agregar otro usuario** es igual: genera su línea y pégala debajo de la de `admin`. Cada usuario ve **solo su propia información**, aunque use el mismo dispositivo.

## 3. Instalarla en cada dispositivo

- **iPhone / iPad (obligatorio):** abre la dirección en **Safari** → botón **Compartir** (□↑) → **Agregar a pantalla de inicio**. Ábrela siempre desde ese ícono. Si no la instalas, iOS puede borrar los datos después de unos días sin usarla.
- **Android:** en Chrome, menú ⋮ → **Instalar aplicación** (o «Agregar a pantalla principal»).
- **Windows / Mac:** en Chrome o Edge, el ícono de instalar en la barra de direcciones (o menú → *Instalar Portafolios Agrícolas*).

La primera vez necesita internet para descargarse; después funciona sin conexión.

## 4. Lo más importante: los respaldos

La información vive **solo en el dispositivo**. Si se pierde el celular, se borran los datos del navegador o se desinstala la app, **se pierde**.

Haz respaldo seguido en **Respaldo → Hacer respaldo**. Es un solo archivo cifrado; guárdalo en una USB, en tu computadora o en Drive. La app te recuerda si pasan más de 7 días sin respaldo.

Con ese mismo archivo pasas tu información a otro dispositivo (**Respaldo → Cargar un respaldo**).

## 5. Actualizar la app

Cuando cambies cualquier archivo en GitHub, sube también el número de `VERSION` en `sw.js`. Los dispositivos descargan la versión nueva la próxima vez que abran la app con internet.

---

### Contenido de la carpeta

```
index.html             Página principal
generar-usuario.html   Herramienta para crear usuarios / contraseñas
config.js              ← Usuarios (aquí se agregan)
estilos.css            Apariencia
sw.js                  Funcionamiento sin internet (subir VERSION al actualizar)
manifest.json          Datos para instalar la app
js/                    Código de la app (comentado en español)
lib/                   Librerías: pdf-lib (PDF) y fontkit (letras)
fonts/                 Letra del contrato (Liberation Serif, licencia libre)
icons/                 Íconos
docs/                  Documentación
```
