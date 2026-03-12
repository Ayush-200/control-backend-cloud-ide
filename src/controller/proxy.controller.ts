import type { Request, Response, NextFunction } from 'express';
import { createProxyMiddleware, type RequestHandler } from 'http-proxy-middleware';
import { getSessionById } from '../repositories/session.repository.js';

// Cache proxy instances (keyed by target to reuse safely)
const proxyCache = new Map<string, RequestHandler>();

// Debug endpoint (unchanged – looks fine)
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

// Proxy handler
export const proxyToContainer = async (req: Request, res: Response, next: NextFunction) => {
  const port = req.params.port as string;
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
  const cacheKey = `${privateIp}:${port}`;

  console.log(`Routing ${sessionId} → ${targetUrl}`);

  // Health check - try multiple common endpoints
  const healthCheckUrls = [
    `${targetUrl}/`,
    `${targetUrl}/health`,
    `${targetUrl}/api/health`,
    `${targetUrl}/status`
  ];

  let isReachable = false;
  let lastError = '';

  for (const checkUrl of healthCheckUrls) {
    try {
      const testResponse = await fetch(checkUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(3000) // Shorter timeout for health checks
      });

      // Accept any 2xx or 3xx status as "reachable"
      if (testResponse.status >= 200 && testResponse.status < 400) {
        console.log(`✅ Container reachable: ${testResponse.status} (${checkUrl})`);
        isReachable = true;
        break;
      } else {
        console.log(`⚠️  Health check ${checkUrl}: ${testResponse.status}`);
        lastError = `HTTP ${testResponse.status}`;
      }
    } catch (err: any) {
      console.log(`⚠️  Health check ${checkUrl} failed: ${err.message}`);
      lastError = err.message;
    }
  }

  if (!isReachable) {
    console.error(`❌ Container NOT reachable: ${lastError}`);
    return res.status(502).json({
      error: 'Container not reachable',
      target: targetUrl,
      details: lastError,
      tried: healthCheckUrls
    });
  }

  let proxy = proxyCache.get(cacheKey);

  if (!proxy) {
    proxy = createProxyMiddleware({
      target: targetUrl,
      changeOrigin: true,
      ws: true,
      proxyTimeout: 60000,     // Allow slow Vite cold starts
      timeout: 60000,
      selfHandleResponse: true, // Enable response handling to rewrite HTML

      pathRewrite: (path) => {
        const prefix = `/output/${port}`;
        if (path.startsWith(prefix)) {
          return path.slice(prefix.length) || '/';
        }
        return path;
      },

      on: {
        proxyReq(proxyReq) {
          proxyReq.setHeader('Host', `${privateIp}:${port}`);

          // Strip sessionId from backend request
          const url = new URL(proxyReq.path, targetUrl);
          url.searchParams.delete('sessionId');
          proxyReq.path = url.pathname + url.search;
        },

        proxyRes(proxyRes, req, res) {
          const _req = req as Request;
          const port = _req.params.port;
          const contentType = proxyRes.headers['content-type'] as string;

          if (contentType && contentType.includes('text/html')) {
            let body = '';

            proxyRes.on('data', (chunk) => {
              body += chunk.toString();
            });

            proxyRes.on('end', () => {
              // Rewrite absolute paths in HTML to include proxy prefix
              const rewritten = body.replace(/(href|src|action|formaction)="\/([^"]*)"/g, `$1="/output/${port}/$2"`);

              // Copy headers except content-length
              Object.keys(proxyRes.headers).forEach(key => {
                if (key !== 'content-length') {
                  res.setHeader(key, proxyRes.headers[key]!);
                }
              });

              res.end(rewritten);
            });
          } else {
            // For non-HTML responses, pipe directly
            Object.keys(proxyRes.headers).forEach(key => {
              res.setHeader(key, proxyRes.headers[key]!);
            });
            proxyRes.pipe(res);
          }
        },

        error(err: any, _req, res) {
          console.error(`Proxy error → ${targetUrl}:`, err);

          // Check if response is Express Response and headers not sent
          if (res && typeof (res as any).status === 'function' && !(res as any).headersSent) {
            (res as Response).status(502).json({
              error: 'Proxy connection failed',
              message: err?.message ?? 'Unknown proxy error',
              target: targetUrl
            });
          } else {
            // Already sent or socket → just log, can't respond
            console.warn('Cannot send error response: headers already sent or socket');
          }
        }
      }
    }) as RequestHandler;

    proxyCache.set(cacheKey, proxy);
    console.log(`Created new proxy for ${cacheKey}`);
  }

  // Call proxy middleware
  proxy(req, res, next);
};