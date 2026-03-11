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
      port5173: `http://localhost:4000/output/${sessionId}/5173/`,
      port3000: `http://localhost:4000/output/${sessionId}/3000/`,
      port8080: `http://localhost:4000/output/${sessionId}/8080/`
    }
  });
};

// Proxy handler for /output/:sessionId/:port routes
export const proxyToContainer = async (req: Request, res: Response, next: NextFunction) => {
  const sessionId = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;
  const port = Array.isArray(req.params.port) ? req.params.port[0] : req.params.port;

  console.log('=== PROXY REQUEST ===');
  console.log('SessionId:', sessionId);
  console.log('Port:', port);
  console.log('Path:', req.path);
  console.log('Original URL:', req.originalUrl);

  if (!sessionId) {
    return res.status(400).json({ 
      error: 'sessionId parameter is required',
      example: `/output/your-session-id/${port}/`
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
  const cacheKey = `${sessionId}:${privateIp}:${port}`;
  
  console.log(`Routing session ${sessionId} to ${targetUrl}`);

  // Get or create cached proxy instance
  let proxy = proxyCache.get(cacheKey);
  
  if (!proxy) {
    proxy = createProxyMiddleware({
      target: targetUrl,
      changeOrigin: true,
      ws: true,
      pathRewrite: (path, req) => {
        // Remove /output/:sessionId/:port prefix
        const newPath = path.replace(`/output/${sessionId}/${port}`, '');
        console.log(`Path rewrite: ${path} -> ${newPath}`);
        return newPath;
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