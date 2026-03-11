import express from 'express';
import { proxyToContainer, getSessionInfo } from '../controller/proxy.controller.js';

const router = express.Router();

// Debug endpoint
router.get('/debug', getSessionInfo);

// Proxy route for all containers
router.all('/output/:sessionId/:port/*path', proxyToContainer);
router.all('/output/:sessionId/:port', proxyToContainer);

export default router;