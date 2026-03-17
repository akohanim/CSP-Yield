import express from "express";
import axios from "axios";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants from constants.ts (manually copied to avoid import issues in server.ts)
const MARKETDATA_API_BASE = "https://api.marketdata.app/v1";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health check and debug info
  app.get("/api/status", (req, res) => {
    res.json({ 
      status: "ok", 
      hasApiKey: !!process.env.MARKETDATA_API_KEY,
      env: process.env.NODE_ENV 
    });
  });

  // API Proxy for MarketData.app to bypass CORS
  app.get("/api/market-data", async (req, res) => {
    const { url } = req.query;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: "Missing URL parameter" });
    }

    const apiKey = process.env.MARKETDATA_API_KEY;
    
    // Ensure we don't send "undefined" or empty string as a token
    const effectiveApiKey = (apiKey && apiKey.trim() !== "") ? apiKey.trim() : null;
    
    console.log(`[Proxy Request] URL: ${url}`);
    if (effectiveApiKey) {
      console.log(`[Proxy Request] Using API Key: ${effectiveApiKey.substring(0, 5)}...`);
    } else {
      console.log(`[Proxy Request] No valid API Key provided, using public/unauthenticated access.`);
    }

    try {
      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'User-Agent': 'CSP-Validator-Pro/1.0'
      };

      if (effectiveApiKey) {
        headers['Authorization'] = `Bearer ${effectiveApiKey}`;
      }

      const response = await axios.get(url, {
        headers,
        timeout: 15000, // 15s timeout
        validateStatus: (status) => status < 500 // Don't throw for 4xx, we want to handle them
      });
      
      if (response.status >= 400) {
        const errorData = response.data || {};
        const errorMsg = errorData.errmsg || errorData.error || `Status ${response.status}`;
        
        console.warn(`[Proxy API Warning] Status: ${response.status}, Message: ${errorMsg}`);
        
        return res.status(response.status).json({
          error: errorMsg,
          s: "error",
          details: errorData
        });
      }

      console.log(`[Proxy Success] Status: ${response.status}`);
      res.json(response.data);
    } catch (error: any) {
      const status = error.response?.status || 500;
      const errorData = error.response?.data || {};
      const errorMsg = errorData.errmsg || errorData.error || error.message;
      
      console.error(`[Proxy Fatal Error] Status: ${status}, Message: ${errorMsg}`);
      
      res.status(status).json({ 
        error: errorMsg,
        s: "error",
        details: errorData 
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
