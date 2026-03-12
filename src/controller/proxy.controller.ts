import type { Request, Response, NextFunction } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { getSessionById } from '../repositories/session.repository.js';

// ✅ Cache — sessionId+port ke basis pe (not just IP:port)
const proxyCache = new Map<string, ReturnType<typeof createProxyMiddleware>>();

// Debug endpoint to check session info
export const getSessionInfo = async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;

  if (!sessionId) {
    return res.status(400).json({ 
      error: 'sessionId query parameter is required',
      example: '/output/debug?sessionId=your-session-id'
    });
  }

  const session = await getSessionById(sessionId);

  if (!session) {
    return res.status(404).json({ 
      error: 'Session not found',
      sessionId: sessionId
    });
  }

  return res.json({
    sessionId: session.sessionId,
    privateIp: session.privateIp,
    taskArn: session.taskArn,
    userId: session.userId,
    projectId: session.projectId,
    createdAt: session.createdAt,
    message: 'Session found successfully',
    testUrls: {
      port5173: `http://localhost:4000/output/5173?sessionId=${sessionId}`,
      port3000: `http://localhost:4000/output/3000?sessionId=${sessionId}`,
    }
  });
};

// Proxy handler for /output/:port routes
export const proxyToContainer = async (req: Request, res: Response, next: NextFunction) => {
  const portParam = req.params.port;
  const port = Array.isArray(portParam) ? portParam[0] : portParam;
  const sessionId = req.query.sessionId as string;

  console.log('=== PROXY REQUEST ===');
  console.log('Port:', port);
  console.log('SessionId:', sessionId);
  console.log('Original URL:', req.originalUrl);
  console.log('Path:', req.path);

  if (!sessionId) {
    return res.status(400).json({ 
      error: 'sessionId query parameter is required',
      example: `/output/${port}?sessionId=your-session-id`
    });
  }

  // Get session from database
  const session = await getSessionById(sessionId);

  if (!session) {
    return res.status(404).json({ 
      error: 'Session not found or expired',
      sessionId: sessionId
    });
  }

  const privateIp = session.privateIp;

  // Validate port number
  const portNum = parseInt(port);
  if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
    return res.status(400).json({ error: 'Invalid port number' });
  }

  const targetUrl = `http://${privateIp}:${port}`;
  
  // ✅ Cache key — sessionId + port
  const cacheKey = `${sessionId}:${port}`;

  console.log(`Routing session ${sessionId} → ${targetUrl}`);

  // ✅ Container reachable hai? Early fail karo
  try {
    const testResponse = await fetch(`http://${privateIp}:${port}/`, { 
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    });
    console.log(`✅ Container reachable: ${testResponse.status}`);
  } catch (err: any) {
    console.log(`❌ Container NOT reachable: ${err.message}`);
    return res.status(502).json({ 
      error: 'Container not reachable. Task still starting or wrong IP.',
      target: targetUrl,
      message: err.message
    });
  }

  // ✅ Get or create cached proxy instance
  let proxy = proxyCache.get(cacheKey);

  if (!proxy) {
    proxy = createProxyMiddleware({
      target: targetUrl,
      changeOrigin: true,
      ws: true,         // WebSocket support for Vite HMR

      on: {
        proxyReq: (proxyReq, req: any) => {
          // ✅ Host header — Vite ko lagega request uske paas directly aa rahi hai
          proxyReq.setHeader('Host', `${privateIp}:${port}`);

          // ✅ sessionId query param strip karo — Vite ko confuse nahi karna
          const url = new URL(proxyReq.path, `http://${privateIp}:${port}`);
          url.searchParams.delete('sessionId');
          proxyReq.path = url.pathname + (url.search || '');

          console.log(`→ Forwarding: ${req.originalUrl} → ${targetUrl}${proxyReq.path}`);
        },

        proxyRes: (proxyRes, req: any) => {
          console.log(`← Response: ${proxyRes.statusCode} for ${req.originalUrl}`);
        },

        error: (err: any, req: any, res: any) => {
          console.error(`❌ Proxy error for ${targetUrl}:`, err.message);
          if (!res.headersSent) {
            res.status(502).json({
              error: 'Proxy connection failed',
              message: err.message,
              target: targetUrl
            });
          }
        }
      }
    });

    proxyCache.set(cacheKey, proxy);
    console.log(`✅ Created new proxy instance for ${cacheKey}`);
  }

  // ✅ Path rewrite manually — /output/5173/anything → /anything
  // Yeh req.url modify karta hai jo proxy use karta hai
  const originalUrl = req.url;
  req.url = req.url.replace(/^\/output\/\d+/, '') || '/';
  console.log(`Path rewrite: ${originalUrl} → ${req.url}`);

  proxy(req, res, next);
};
