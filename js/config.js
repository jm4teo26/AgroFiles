// =====================================================================
// config.js — Configuración que puedes editar a mano
// =====================================================================

// ---------------------------------------------------------------------
// USUARIOS
// Para agregar un usuario o cambiar una contraseña abre el archivo
// "generar-usuario.html" (está en la misma carpeta que index.html),
// escribe el usuario y la contraseña, y copia aquí la línea que te da.
//
// ¡Nunca escribas la contraseña tal cual en este archivo!
// Lo que va aquí ("sal" y "verificador") no permite descifrar los datos.
//
// IMPORTANTE: el usuario "admin" trae la contraseña TEMPORAL
// "Cambiar.2026". Cámbiala antes de guardar documentos reales.
// ---------------------------------------------------------------------
export const USUARIOS = [
  {
    usuario: 'admin',
    nombre: 'Administrador',
    sal: 'dzMfF28K8q8DwD/rrE8jeg==',
    verificador: '0B5GmOgoPJGhDFtrghZN0eB/aiSBJ5PjtRIFDZyvTGs=',
  },
  // { usuario: 'otro', nombre: 'Otra persona', sal: '...', verificador: '...' },
];

// Número de vueltas de PBKDF2. No lo cambies: si lo cambias, las
// contraseñas que ya generaste dejarán de funcionar.
export const ITERACIONES = 310000;

// Minutos sin usar la app antes de que se cierre la sesión sola.
export const MINUTOS_BLOQUEO = 30;

// Días de anticipación para avisar que un documento está por vencer.
export const DIAS_AVISO = 15;

// ---------------------------------------------------------------------
// TIPOS DE DOCUMENTO
//   ambito: 'persona'  → documento de una persona (acta, CURP, INE...)
//           'parcela'  → documento que acredita la propiedad de la parcela
//           'contrato' → el contrato ya firmado y escaneado
//   vence:  cómo se calcula el vencimiento
//           { meses: 3 } → X meses desde la fecha de emisión
//           { dias: 30 } → X días desde la fecha de emisión
//           'ine'        → se vence al terminar el año de vigencia de la INE
// ---------------------------------------------------------------------
export const TIPOS_DOCUMENTO = {
  ACTA:     { nombre: 'Acta de nacimiento', ambito: 'persona' },
  CURP:     { nombre: 'CURP', ambito: 'persona' },
  INE:      { nombre: 'INE', ambito: 'persona', vence: 'ine' },
  CSF:      { nombre: 'Constancia de Situación Fiscal', ambito: 'persona', vence: { meses: 3 } },
  OPINION:  { nombre: 'Opinión de Cumplimiento (SAT)', ambito: 'persona', vence: { dias: 30 } },
  OTRO:     { nombre: 'Otro documento', ambito: 'persona' },

  CERTIFICADO: { nombre: 'Certificado parcelario', ambito: 'parcela' },
  CARTA:       { nombre: 'Carta notariada / documento de propiedad', ambito: 'parcela' },

  CONTRATO_FIRMADO: { nombre: 'Contrato firmado', ambito: 'contrato' },
};

// Documentos personales que se proponen marcados al crear un portafolio.
export const REQUERIDOS_POR_DEFECTO = ['ACTA', 'CURP', 'INE', 'CSF', 'OPINION'];

// Valores que se proponen al capturar parcelas y contratos.
export const VALORES_POR_DEFECTO = {
  municipio: 'GUASAVE',
  estado: 'SINALOA',
  cultivo: 'MAÍZ',
};
