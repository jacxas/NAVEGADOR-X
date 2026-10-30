import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import dotenv from "dotenv";
import { db } from "./db.ts";
import { GEMINI_MODEL, getGeminiClient, isGeminiConfigured } from "./server/gemini.ts";
import { getVPNGateServers } from "./server/vpn-gate.ts";
import { callOllama, ollamaHealth } from "./server/ollama.ts";
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

  // API v1 - VPN Gate catalogue. Discovery is real; tunnel control is not
  // exposed until the native OpenVPN process adapter is implemented and tested.
  app.get("/api/v1/vpn/servers", async (_req, res) => {
    try {
      const result = await getVPNGateServers();
      res.setHeader("Cache-Control", "public, max-age=30");
      res.json(result);
    } catch (error) {
      console.error("[VPN Gate] Catalogue unavailable:", error);
      res.status(502).json({
        error: "VPN Gate catalogue is temporarily unavailable.",
        code: "VPN_GATE_CATALOGUE_UNAVAILABLE",
      });
    }
  });

  app.post("/api/v1/vpn/connect", (_req, res) => {
    res.status(501).json({
      error: "Native OpenVPN adapter is not installed. No VPN connection was started.",
      code: "VPN_NATIVE_ADAPTER_NOT_IMPLEMENTED",
    });
  });

  app.post("/api/v1/vpn/disconnect", (_req, res) => {
    res.status(501).json({
      error: "Native OpenVPN adapter is not installed. No VPN connection state is available.",
      code: "VPN_NATIVE_ADAPTER_NOT_IMPLEMENTED",
    });
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

  // AI Query: local-first by default. Cloud use requires an explicit mode.
  app.post("/api/v1/ai/query", aiLimiter, async (req, res) => {
    const parsed = validateAiQuery(req.body);
    if (parsed.ok === false) return res.status(400).json({ error: parsed.error });

    const { prompt, systemInstruction, mode } = parsed.value;
    const instructions = systemInstruction ||
      "Eres la IA contextual e integrada de Navegador X. Responde de forma concisa y profesional.";

    if (mode === 'local' || mode === 'hybrid') {
      try {
        const result = await callOllama(prompt, { systemInstruction: instructions });
        return res.json({ ...result, mode: 'local' });
      } catch (error) {
        console.warn("[NavegadorX] Ollama local no disponible:", error instanceof Error ? error.message : String(error));
        if (mode === 'local') {
          return res.status(503).json({
            error: "Ollama no está disponible o el modelo local no está instalado. No se enviaron datos a la nube.",
            code: "OLLAMA_UNAVAILABLE",
            mode: 'local',
          });
        }
      }
    }

    if (mode === 'cloud' || mode === 'hybrid') {
      const ai = getGeminiClient();
      if (!ai) {
        return res.status(503).json({
          error: mode === 'hybrid'
            ? "Ollama no está disponible y Gemini no está configurado. No se generó respuesta."
            : "Gemini no está configurado en el servidor.",
          code: "GEMINI_NOT_CONFIGURED",
          mode,
        });
      }
      try {
        const response = await ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: prompt,
          config: { systemInstruction: instructions, temperature: 0.7 },
        });
        return res.json({
          response: response.text || "No se obtuvo respuesta del motor IA.",
          provider: "Gemini",
          offline: false,
          mode: 'cloud',
          fallbackUsed: mode === 'hybrid',
        });
      } catch (error) {
        console.error("Error en /api/v1/ai/query:", error);
        return res.status(502).json({ error: "El proveedor Gemini no respondió correctamente.", code: "GEMINI_REQUEST_FAILED" });
      }
    }
  });

  app.get("/api/v1/ai/local-status", async (_req, res) => {
    const status = await ollamaHealth();
    res.json({ ...status, geminiConfigured: isGeminiConfigured() });
  });

  // AI Instant Translate: obey the same explicit local/cloud/hybrid policy.
  app.post("/api/v1/ai/translate", aiLimiter, async (req, res) => {
    const parsed = validateTranslate(req.body);
    if (parsed.ok === false) return res.status(400).json({ error: parsed.error });

    const { url, targetLanguage, pageContent, mode } = parsed.value;
    if (!pageContent) {
      return res.status(422).json({
        success: false,
        error: "No se recibió el contenido de la página. No se puede traducir una URL sin leer su contenido.",
        code: "PAGE_CONTENT_REQUIRED",
      });
    }

    const prompt = `Traduce fielmente el siguiente contenido al idioma "${targetLanguage}".
No inventes información ni agregues contenido que no aparezca en el original.
URL de origen: ${url}

CONTENIDO:
${pageContent}`;

    try {
      if (mode === 'local' || mode === 'hybrid') {
        try {
          const result = await callOllama(prompt, {
            temperature: 0.3,
            systemInstruction: "Eres un traductor profesional. Conserva el significado, formato y nombres propios.",
          });
          return res.json({
            success: true,
            translatedContent: result.response,
            targetLanguage,
            url,
            provider: result.provider,
            offline: true,
            mode: 'local',
          });
        } catch (error) {
          if (mode === 'local') {
            return res.status(503).json({
              success: false,
              error: "Ollama no está disponible. No se envió el contenido a la nube.",
              code: "OLLAMA_UNAVAILABLE",
            });
          }
          console.warn("[NavegadorX] Ollama translation unavailable; explicit hybrid fallback:", error);
        }
      }

      const ai = getGeminiClient();
      if (!ai) {
        return res.status(503).json({
          success: false,
          error: "Gemini no está configurado para el modo cloud solicitado.",
          code: "GEMINI_NOT_CONFIGURED",
        });
      }
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: { temperature: 0.3 },
      });
      return res.json({
        success: true,
        translatedContent: response.text || "No se pudo generar la traducción.",
        targetLanguage,
        url,
        provider: "Gemini",
        offline: false,
        mode: 'cloud',
        fallbackUsed: mode === 'hybrid',
      });
    } catch (error) {
      console.error("Error en /api/v1/ai/translate:", error);
      return res.status(502).json({ success: false, error: "El proveedor de IA no respondió correctamente." });
    }
  });

  // Panel de minería: demostración de interfaz con cifras fijas.
  // No hay minería real: `active: false` y `simulated: true` lo dejan claro.
  app.get("/api/miner/status", (req, res) => {
    res.json({
      active: false,
      simulated: true,
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
