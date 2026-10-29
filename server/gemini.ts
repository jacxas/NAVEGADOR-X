/**
 * Cliente de Gemini del servidor web.
 *
 * La credencial se lee **solo** de la variable de entorno `GEMINI_API_KEY`. No hay
 * valor por defecto, ni copia en disco, ni forma de pasarla por la URL: si no está,
 * el servidor responde con el motor local offline y la aplicación sigue arrancando.
 */

import { GoogleGenAI } from '@google/genai';

/** Modelo usado por los endpoints de IA. */
export const GEMINI_MODEL = 'gemini-3.6-flash';

/** Tiempo máximo por llamada al proveedor (ms). Sin esto, una petición podía
 *  quedarse colgada y consumir una conexión del servidor indefinidamente. */
const REQUEST_TIMEOUT_MS = 30_000;

let client: GoogleGenAI | null = null;

/** ¿Hay credencial configurada? No revela su valor. */
export function isGeminiConfigured(): boolean {
  const value = process.env.GEMINI_API_KEY;
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Cliente perezoso y único. Devuelve `null` cuando no hay clave: quien llama debe
 * caer al motor local en ese caso.
 */
export function getGeminiClient(): GoogleGenAI | null {
  if (!isGeminiConfigured()) return null;
  if (client) return client;

  // La clave vive en el entorno del proceso; nunca se escribe ni se devuelve.
  const credential = process.env.GEMINI_API_KEY!.trim();

  client = new GoogleGenAI({
    apiKey: credential,
    httpOptions: {
      timeout: REQUEST_TIMEOUT_MS,
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  return client;
}

/** Solo para pruebas: olvida el cliente memoizado. */
export function resetGeminiClient(): void {
  client = null;
}
