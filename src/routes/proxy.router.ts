import express from 'express';
import { proxyToContainer, getSessionInfo } from '../controller/proxy.controller.js';

const router = express.Router();

// Debug endpoint
router.get('/debug', getSessionInfo);

// Proxy routes - no /output prefix needed since router is mounted at /output
router.all('/:sessionId/:port/*path', proxyToContainer);
router.all('/:sessionId/:port', proxyToContainer);

export default router;