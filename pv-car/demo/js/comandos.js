// Intérprete de comandos de voz del copiloto Pascal.
// Recibe el texto que entrega el reconocedor y devuelve la acción a ejecutar.
// Es puro (sin DOM) para poder probarlo con `node --test`.

export const ACCIONES = {
  iniciar: "iniciar",
  detener: "detener",
  proteger: "proteger",
  foto: "foto",
  ahorroOn: "ahorro-on",
  ahorroOff: "ahorro-off",
  estado: "estado",
};

/** Minúsculas, sin tildes ni signos, espacios simples. */
export function normalizar(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ñ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// El reconocedor suele escribir «pascal» como «pascual», «pásca» o «pasca l».
const NOMBRE = "(?:pascal|pascual|pasca l|pascale|pasqual|pascal ia|pascalia)";
const SALUDO = "(?:hola|ola|okay|okey|ok|oye|hey|ey)";
const WAKE = new RegExp(`(?:^| )${SALUDO} ${NOMBRE}(?: |$)`);

/**
 * Busca la palabra de activación. Devuelve el texto que viene después
 * (posible comando) o null si no se dijo «Hola/Okay Pascal».
 */
export function separarActivacion(texto) {
  const t = normalizar(texto);
  const m = WAKE.exec(t);
  if (!m) return null;
  return t.slice(m.index + m[0].length).trim();
}

// El orden importa: las frases más específicas primero.
const REGLAS = [
  { accion: ACCIONES.ahorroOff, re: /\b(?:(?:sal|salir|quita|quitar|desactiva|desactivar|apaga|apagar|termina|terminar)(?: del?| el)? (?:modo )?ahorro|pantalla normal|enciende la pantalla)\b/ },
  { accion: ACCIONES.ahorroOn, re: /\b(?:(?:modo )?ahorro(?: termico| de energia| de bateria)?|atenua(?:r)? la pantalla|baja(?:r)? (?:el )?brillo|se esta calentando|esta caliente)\b/ },
  { accion: ACCIONES.proteger, re: /\b(?:guarda(?:r)?(?: este| el)? (?:video|clip)|protege(?:r)?(?: este| el)?(?: video| clip)?|acaba de pasar un accidente|hubo un accidente|accidente|choque|me chocaron|emergencia|incidente|novedad|blinda(?:r)?(?: el)?(?: video| clip)?)\b/ },
  { accion: ACCIONES.foto, re: /\b(?:toma(?:r)?(?: una)? (?:foto|fotografia|captura)|foto|captura(?: de pantalla)?|fotografia)\b/ },
  { accion: ACCIONES.detener, re: /\b(?:deten(?:er)?|para(?:r)?|pausa(?:r)?|termina(?:r)?|apaga(?:r)?|finaliza(?:r)?|corta(?:r)?)(?: la)? (?:grabacion|grabar|camara|video)\b|\bdeja de grabar\b/ },
  { accion: ACCIONES.iniciar, re: /\b(?:activa(?:r)?|inicia(?:r)?|empieza|empezar|comienza|comenzar|enciende|encender|arranca(?:r)?|prende(?:r)?)(?: la)? (?:grabacion|grabar|camara|video)\b|\b(?:graba|empieza a grabar|ponte a grabar)\b/ },
  { accion: ACCIONES.estado, re: /\b(?:estado|como vamos|cuanto espacio|espacio libre|cuanta memoria)\b/ },
];

/** Interpreta un comando (texto sin la palabra de activación). */
export function interpretar(comando) {
  const t = normalizar(comando);
  if (!t) return null;
  for (const r of REGLAS) if (r.re.test(t)) return r.accion;
  return null;
}

/**
 * Máquina de estados mínima: si el conductor dice solo «Hola Pascal» y hace una
 * pausa, el siguiente enunciado dentro de `ventanaMs` se toma como comando.
 */
export class Copiloto {
  constructor({ ventanaMs = 7000, ahora = () => Date.now() } = {}) {
    this.ventanaMs = ventanaMs;
    this.ahora = ahora;
    this.escuchandoHasta = 0;
  }

  /**
   * @param {string} texto enunciado final del reconocedor
   * @returns {{tipo:'accion',accion:string}|{tipo:'atento'}|{tipo:'desconocido',texto:string}|null}
   */
  oir(texto) {
    const resto = separarActivacion(texto);
    if (resto !== null) {
      if (!resto) {
        this.escuchandoHasta = this.ahora() + this.ventanaMs;
        return { tipo: "atento" };
      }
      const accion = interpretar(resto);
      this.escuchandoHasta = 0;
      return accion ? { tipo: "accion", accion } : { tipo: "desconocido", texto: resto };
    }
    if (this.escuchandoHasta && this.ahora() <= this.escuchandoHasta) {
      this.escuchandoHasta = 0;
      const accion = interpretar(texto);
      return accion ? { tipo: "accion", accion } : { tipo: "desconocido", texto: normalizar(texto) };
    }
    return null; // conversación ajena: se ignora
  }
}
