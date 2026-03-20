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

  // Simple in-memory cache for bulk options
  const bulkCache = new Map<string, { data: any, timestamp: number }>();
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  // Bulk Options Chain Endpoint
  app.get("/api/bulk-options", async (req, res) => {
    const { ticker } = req.query;
    if (!ticker || typeof ticker !== 'string') {
      return res.status(400).json({ error: "Missing ticker parameter" });
    }

    const upperTicker = ticker.toUpperCase();
    const now = Date.now();
    
    // Check cache
    const cached = bulkCache.get(upperTicker);
    if (cached && (now - cached.timestamp) < CACHE_TTL) {
      console.log(`[Bulk Options Cache Hit] Ticker: ${upperTicker}`);
      return res.json(cached.data);
    }

    const apiKey = process.env.MARKETDATA_API_KEY;
    const effectiveApiKey = (apiKey && apiKey.trim() !== "") ? apiKey.trim() : null;
    
    console.log(`[Bulk Options Request] Ticker: ${upperTicker}`);

    try {
      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'User-Agent': 'CSP-Validator-Pro/1.0'
      };

      if (effectiveApiKey) {
        headers['Authorization'] = `Bearer ${effectiveApiKey}`;
      }

      // Step 1: Fetch expirations list
      const expUrl = `${MARKETDATA_API_BASE}/options/expirations/${upperTicker}/`;
      const expResponse = await axios.get(expUrl, { headers });
      
      if (expResponse.status >= 400 || !expResponse.data || expResponse.data.s !== 'ok') {
        return res.status(expResponse.status || 500).json(expResponse.data || { error: "Failed to fetch expirations" });
      }

      const expirations = (expResponse.data.expirations || []).slice(0, 26);
      console.log(`[Bulk Options] Found ${expirations.length} expirations for ${upperTicker}`);

      // Step 2: Fetch all chains in parallel
      const expirationsMap: Record<string, any[]> = {};
      
      const chainPromises = expirations.map(async (expDate: string) => {
        try {
          const chainUrl = `${MARKETDATA_API_BASE}/options/chain/${upperTicker}/?side=put&expiration=${expDate}&range=all`;
          const chainResponse = await axios.get(chainUrl, { headers, timeout: 10000 });
          
          if (chainResponse.data && chainResponse.data.s === 'ok' && chainResponse.data.strike) {
            const data = chainResponse.data;
            const contracts = [];
            for (let i = 0; i < data.strike.length; i++) {
              contracts.push({
                ticker: (data.optionSymbol && data.optionSymbol[i]) || (data.symbol && data.symbol[i]) || 'UNKNOWN',
                strike: data.strike[i],
                bid: data.bid ? data.bid[i] : 0,
                ask: data.ask ? data.ask[i] : 0,
                last: data.last ? data.last[i] : 0,
                vol: data.volume ? data.volume[i] : 0,
                oi: data.openInterest ? data.openInterest[i] : 0,
                delta: data.delta ? data.delta[i] : -0.3,
                theta: data.theta ? data.theta[i] : -0.05
              });
            }
            expirationsMap[expDate] = contracts;
          }
        } catch (err: any) {
          console.error(`[Bulk Options] Failed to fetch chain for ${expDate}: ${err.message}`);
        }
      });

      await Promise.all(chainPromises);

      const result = {
        s: 'ok',
        expirations: expirationsMap
      };

      // Store in cache
      bulkCache.set(upperTicker, { data: result, timestamp: now });

      console.log(`[Bulk Options Success] Aggregated ${Object.keys(expirationsMap).length} expirations for ${upperTicker}`);
      return res.json(result);
    } catch (error: any) {
      console.error(`[Bulk Options Error] ${error.message}`);
      res.status(500).json({ error: error.message });
    }
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
        
        // Handle specific status codes as requested
        if (response.status === 401) {
          return res.status(401).json({
            error: "Unauthorized: Invalid or missing API Token.",
            s: "error",
            details: errorData
          });
        }
        
        if (response.status === 429) {
          return res.status(429).json({
            error: "Rate Limit Exceeded: Please slow down or upgrade your plan.",
            s: "error",
            details: errorData
          });
        }

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
