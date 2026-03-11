import express from 'express';
import { proxyToContainer, getSessionInfo } from '../controller/proxy.controller.js';

const router = express.Router();

// Debug endpoint to check session info
router.get('/debug', getSessionInfo);

// New proxy route structure: /output/:sessionId/:port/*
// Use splat parameter to catch all paths
router.all('/:sessionId/:port/*splat', proxyToContainer);
router.all('/:sessionId/:port', proxyToContainer);

export default router;