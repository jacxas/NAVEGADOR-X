import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import dotenv from "dotenv";
import { db } from "./db.ts";
import { GEMINI_MODEL, getGeminiClient, isGeminiConfigured } from "./server/gemini.ts";
import {
  createRateLimiter,
  isSafeId,
  sanitizeRecord,
  validateAiQuery,
  validateTranslate,
} from "./server/guardrails.ts";

dotenv.config();

/**
 * Interfaz de escucha.
 *
 * Por defecto el servidor **solo** atiende en loopback (127.0.0.1): es una
 * aplicación de escritorio, no un servicio para la red local. Para exponerlo a
 * propósito, `NAVEGADOR_HOST=0.0.0.0`. Un valor inválido hace fallar el arranque
 * en vez de escuchar en todas las interfaces por accidente.
 */
function resolveHost(): string {
  const requested = process.env.NAVEGADOR_HOST?.trim() || "127.0.0.1";
  if (!/^[A-Za-z0-9.:\[\]-]+$/.test(requested)) {
    throw new Error(`NAVEGADOR_HOST no es una dirección válida: ${requested}`);
  }
  return requested;
}

const HOST = resolveHost();
const PORT = Number(process.env.PORT || 3000);

async function startServer() {
  const app = express();

  // Detrás de un proxy no se confía en las cabeceras de reenvío: el limitador
  // usa la dirección real de la conexión.
  app.disable("x-powered-by");
  app.use(express.json({ limit: "256kb" }));

  const aiLimiter = createRateLimiter({ windowMs: 60_000, max: 30 });
  const writeLimiter = createRateLimiter({ windowMs: 60_000, max: 60 });

  // API v1 - VPN
  app.get("/api/v1/vpn/servers", async (req, res) => {
    try {
      const servers = await db.vPNServer.findMany();
      res.json(servers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch servers" });
    }
  });

  app.post("/api/v1/vpn/connect", async (req, res) => {
    const { serverId, protocol } = req.body;
    if (!serverId || !protocol) return res.status(400).json({ error: "Faltan parámetros" });
    // Aquí: llamar a WireGuard/OpenVPN wrapper
    res.json({ status: "connected", serverId, protocol });
  });

  app.post("/api/v1/vpn/disconnect", async (req, res) => {
    // Aquí: cerrar tunnel VPN
    res.json({ status: "disconnected" });
  });

  // Sessions
  app.post("/api/v1/sessions", writeLimiter, async (req, res) => {
    // Se copia solo lo serializable y se descartan claves peligrosas: estos
    // objetos acababan tal cual en un JSON en disco.
    const data = sanitizeRecord(req.body);
    if (!data) return res.status(400).json({ error: "El cuerpo debe ser un objeto JSON." });

    try {
      const session = await db.browsingSession.create({ data });
      res.status(201).json(session);
    } catch (error) {
      console.error("Error en POST /api/v1/sessions:", error);
      res.status(500).json({ error: "No se pudo crear la sesión." });
    }
  });

  app.put("/api/v1/sessions/:id", writeLimiter, async (req, res) => {
    if (!isSafeId(req.params.id)) return res.status(400).json({ error: "Identificador no válido." });

    const data = sanitizeRecord(req.body);
    if (!data) return res.status(400).json({ error: "El cuerpo debe ser un objeto JSON." });

    try {
      const session = await db.browsingSession.update({ where: { id: req.params.id }, data });
      res.json(session);
    } catch (error) {
      console.error("Error en PUT /api/v1/sessions/:id:", error);
      res.status(500).json({ error: "No se pudo actualizar la sesión." });
    }
  });

  // AI Preferences
  app.get("/api/v1/ai/preferences/:userId", async (req, res) => {
    if (!isSafeId(req.params.userId)) return res.status(400).json({ error: "Identificador no válido." });

    try {
      const prefs = await db.aIPreference.findFirst({ where: { userId: req.params.userId } });
      res.json(prefs);
    } catch (error) {
      console.error("Error en GET /api/v1/ai/preferences:", error);
      res.status(500).json({ error: "No se pudieron leer las preferencias." });
    }
  });

  app.put("/api/v1/ai/preferences/:userId", writeLimiter, async (req, res) => {
    if (!isSafeId(req.params.userId)) return res.status(400).json({ error: "Identificador no válido." });

    const data = sanitizeRecord(req.body);
    if (!data) return res.status(400).json({ error: "El cuerpo debe ser un objeto JSON." });

    try {
      const prefs = await db.aIPreference.upsert({
        where: { userId: req.params.userId },
        update: data,
        create: { ...data, userId: req.params.userId }
      });
      res.json(prefs);
    } catch (error) {
      console.error("Error en PUT /api/v1/ai/preferences:", error);
      res.status(500).json({ error: "No se pudieron guardar las preferencias." });
    }
  });

  // AI Query via Gemini Server Proxy
  app.post("/api/v1/ai/query", aiLimiter, async (req, res) => {
    const parsed = validateAiQuery(req.body);
    if (parsed.ok === false) return res.status(400).json({ error: parsed.error });

    const { prompt, systemInstruction } = parsed.value;

    try {
      const ai = getGeminiClient();

      if (!ai) {
        return res.json({
          response: `[Modo Offline/Sin API Key] Respuesta simulada a: "${prompt.slice(0, 500)}". Para habilitar Gemini real en el servidor, configure GEMINI_API_KEY en las variables de entorno.`,
          provider: "Local Offline Engine"
        });
      }

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          systemInstruction: systemInstruction || "Eres la IA contextual e integrada del microkernel 'X Runtime OS' / 'Navegador X'. Responde de forma concisa y profesional.",
          temperature: 0.7,
        }
      });

      res.json({
        response: response.text || "No se obtuvo respuesta del motor IA.",
        provider: "Gemini 3.6 Flash"
      });
    } catch (error) {
      // El detalle se queda en el registro del servidor: puede incluir la URL
      // interna del proveedor o partes de la petición.
      console.error("Error en /api/v1/ai/query:", error);
      res.status(502).json({ error: "El proveedor de IA no respondió correctamente." });
    }
  });

  // AI Instant Translate via Gemini
  app.post("/api/v1/ai/translate", aiLimiter, async (req, res) => {
    const parsed = validateTranslate(req.body);
    if (parsed.ok === false) return res.status(400).json({ error: parsed.error });

    const { url, targetLanguage, pageContent } = parsed.value;

    try {
      const ai = getGeminiClient();

      if (!ai) {
        return res.json({
          success: true,
          translatedContent: `### Traducción Instantánea de Navegador X [${targetLanguage}]

**Resumen de la página (${url || 'Pestaña activa'})**:
Esta página web ha sido traducida al **${targetLanguage}**. Se trata de un sitio web con información técnica y noticias de tecnología, finanzas descentralizadas y servicios de red.

**Contenido traducido principal**:
- **Bienvenido a Navegador X**: La plataforma de navegación descentralizada con soporte multicadena y túneles cuánticos de privacidad.
- **Servicios de Red**: Acceso a nodos VPN de alta velocidad en Suiza, Islandia y Singapur con cifrado AES-256.
- **Modulo de Minería**: Optimización energética automática y rendimiento de red en tiempo real.
- **Seguridad**: Todas las conexiones están protegidas contra fugas de DNS y malware activo.`,
          targetLanguage,
          url,
          provider: "Fallback Local Engine"
        });
      }

      const prompt = `Eres el traductor instantáneo inteligente integrado en el navegador 'Navegador X', alimentado por el modelo Gemini.

Traducción requerida:
- URL del sitio web: ${url || 'Pestaña Activa de Navegador X'}
- Idioma de destino: ${targetLanguage}
${pageContent ? `- Contenido extraído del sitio:\n${pageContent}` : ''}

Por favor traduce el contenido de la página web al idioma de destino "${targetLanguage}".
Responde con un formato elegante en Markdown con la siguiente estructura:
1. **Resumen de la Página**: 2 o 3 oraciones que sinteticen el sitio traducido en ${targetLanguage}.
2. **Titular Traducido**: El título principal adaptado al ${targetLanguage}.
3. **Contenido Principal Traducido**: La traducción fiel, fluida y precisa de las secciones principales.
4. **Highlights / Menú de Navegación Traducido**: 3-4 puntos clave traducidos al ${targetLanguage}.`;

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          temperature: 0.3,
        }
      });

      const translatedContent = response.text || "No se pudo generar la traducción.";

      return res.json({
        success: true,
        translatedContent,
        targetLanguage,
        url,
        provider: "Gemini 3.6 Flash"
      });
    } catch (error) {
      console.error("Error en /api/v1/ai/translate:", error);
      res.status(502).json({ error: "El proveedor de IA no respondió correctamente." });
    }
  });

  // Estado del motor de IA: la interfaz puede avisar de que está en modo local
  // sin intentar primero una llamada que fallaría. Nunca devuelve la credencial.
  app.get("/api/v1/ai/status", (req, res) => {
    res.json({
      configured: isGeminiConfigured(),
      model: isGeminiConfigured() ? GEMINI_MODEL : "local-offline",
    });
  });

  // Legacy/Internal Miner Stats
  app.get("/api/miner/status", (req, res) => {
    res.json({
      active: true,
      hashrate: 482.5,
      temp: 42,
      nodes: 12,
      uptime: "14:02:11"
    });
  });

  // Una ruta de API que no existe responde JSON, no el index.html del SPA:
  // si no, el cliente recibe HTML y falla al parsearlo.
  app.use("/api", (req, res) => {
    res.status(404).json({ error: "Ruta de API no encontrada." });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use('/NAVEGADOR-X', express.static(distPath));
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Último recurso: un JSON malformado o un error de middleware no debe tumbar
  // el proceso ni devolver una traza al cliente.
  app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (res.headersSent) return next(error);
    if (error?.type === "entity.parse.failed") {
      return res.status(400).json({ error: "JSON malformado." });
    }
    if (error?.type === "entity.too.large") {
      return res.status(413).json({ error: "El cuerpo de la petición es demasiado grande." });
    }
    console.error("Error no controlado en el servidor:", error);
    res.status(500).json({ error: "Error interno del servidor." });
  });

  const httpServer = app.listen(PORT, HOST, () => {
    console.log(`Navegador X Core running at http://${HOST}:${PORT}`);
  });

  // Un puerto ocupado no debe dejar el proceso «vivo» sin servir nada.
  httpServer.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE") {
      console.error(`El puerto ${PORT} ya está en uso. Cierra el otro proceso o usa PORT=…`);
    } else {
      console.error("No se pudo iniciar el servidor:", error);
    }
    process.exitCode = 1;
  });
}

startServer();
