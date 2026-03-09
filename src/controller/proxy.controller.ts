import type { Request, Response, NextFunction } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { getSessionById } from '../repositories/session.repository.js';

// Cache proxy instances to prevent memory leaks
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
      port8080: `http://localhost:4000/output/8080?sessionId=${sessionId}`
    }
  });
};

// Proxy handler for /output/:port routes`
export const proxyToContainer = async (req: Request, res: Response, next: NextFunction) => {
  const portParam = req.params.port;
  const port = Array.isArray(portParam) ? portParam[0] : portParam;
  const sessionId = req.query.sessionId as string;

  console.log('=== PROXY REQUEST ===');
  console.log('Port:', port);
  console.log('SessionId:', sessionId);
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
  const cacheKey = `${privateIp}:${port}`;
  
  console.log(`Routing session ${sessionId} to ${targetUrl}`);

  // Get or create cached proxy instance
  let proxy = proxyCache.get(cacheKey);
  
  if (!proxy) {
    proxy = createProxyMiddleware({
      target: targetUrl,
      changeOrigin: true,
      ws: true,
      pathRewrite: {
        [`^/output/${port}`]: '' // Remove /output/:port prefix
      }
    });
    
    proxyCache.set(cacheKey, proxy);
    console.log(`Created proxy instance for ${cacheKey}`);
  }

  // Execute the proxy with error handling
  try {
    proxy(req, res, next);
  } catch (err: any) {
    console.error(`Proxy error for ${targetUrl}:`, err.message);
    if (!res.headersSent) {
      res.status(502).json({ 
        error: 'Failed to connect to container',
        message: err.message,
        target: targetUrl
      });
    }
  }
};
