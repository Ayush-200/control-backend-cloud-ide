import express from 'express';
import { proxyToContainer, getSessionInfo } from '../controller/proxy.controller.js';

const router = express.Router();

// Debug endpoint to check session info
router.get('/debug', getSessionInfo);

// Proxy route - forwards all requests to container's localhost:port
router.all('/:port/*path', proxyToContainer);
router.all('/:port', proxyToContainer);

export default router;
