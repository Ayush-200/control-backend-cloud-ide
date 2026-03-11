import { Request, Response, NextFunction } from 'express';
import { createProxyMiddleware, RequestHandler } from 'http-proxy-middleware';
import { getSessionById } from '../repositories/session.repository.js';

// Cache proxy instances to reuse them
export const proxyCache = new Map<string, RequestHandler>();

/**
 * Debug endpoint: returns session info
 */
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
      sessionId
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

/**
 * Proxy middleware: forwards requests to the container
 * Handles path rewriting so absolute paths work
 */
export const proxyToContainer = async (req: Request, res: Response, next: NextFunction) => {
  const sessionId = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;
  const port = Array.isArray(req.params.port) ? req.params.port[0] : req.params.port;

  console.log('=== PROXY REQUEST ===');
  console.log('SessionId:', sessionId);
  console.log('Port:', port);
  console.log('Path:', req.path);
  console.log('Original URL:', req.originalUrl);
  console.log('Params:', req.params);
  console.log('URL:', req.url);

  if (!sessionId || !port) {
    return res.status(400).json({ 
      error: 'sessionId and port are required in the path',
      example: `/output/your-session-id/5173/`
    });
  }

  const session = await getSessionById(sessionId);
  if (!session) {
    return res.status(404).json({ 
      error: 'Session not found or expired',
      sessionId
    });
  }

  const privateIp = session.privateIp;
  const portNum = parseInt(port, 10);
  if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
    return res.status(400).json({ error: 'Invalid port number' });
  }

  const targetUrl = `http://${privateIp}:${port}`;
  const cacheKey = `${sessionId}:${privateIp}:${port}`;

  console.log(`Routing session ${sessionId} to ${targetUrl}`);

  // Test connection to container before proxying
  try {
    const testResponse = await fetch(`http://${privateIp}:8080/health`, { 
      method: 'GET',
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });
    console.log(`Container health check: ${testResponse.status}`);
  } catch (healthError: any) {
    console.error(`Container health check failed: ${healthError.message}`);
    return res.status(502).json({ 
      error: 'Container not accessible',
      message: `Cannot reach container at ${privateIp}:8080`,
      details: healthError.message
    });
  }

  // Test if the target port is accessible
  try {
    const portTestResponse = await fetch(`http://${privateIp}:${port}/`, { 
      method: 'GET',
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });
    console.log(`Target port ${port} check: ${portTestResponse.status}`);
  } catch (portError: any) {
    console.error(`Target port ${port} check failed: ${portError.message}`);
    return res.status(502).json({ 
      error: 'Target port not accessible',
      message: `No service running on ${privateIp}:${port}`,
      details: portError.message,
      suggestion: 'Make sure your dev server is running with --host 0.0.0.0'
    });
  }

  // Get or create cached proxy instance
  let proxy = proxyCache.get(cacheKey);

  if (!proxy) {
    proxy = createProxyMiddleware({
      target: targetUrl,
      changeOrigin: true,
      ws: true, // forward WebSocket connections for HMR
      pathRewrite: (path) => {
        // The path here already has /output stripped by Express router mounting
        // We need to remove /:sessionId/:port from the beginning
        const prefix = `/${sessionId}/${port}`;
        const newPath = path.startsWith(prefix) ? path.replace(prefix, '') || '/' : path;
        console.log(`Path rewrite: ${path} -> ${newPath}`);
        return newPath;
      }
    });

    proxyCache.set(cacheKey, proxy);
    console.log(`Created proxy instance for ${cacheKey}`);
  }

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