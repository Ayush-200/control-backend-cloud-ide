import express from 'express';
import { proxyToContainer, getSessionInfo } from '../controller/proxy.controller.js';

const router = express.Router();

// Debug endpoint to check session info
router.get('/debug', getSessionInfo);

// New proxy route structure: /output/:sessionId/:port/*
// This ensures every request contains routing information
router.all('/:sessionId/:port/*', proxyToContainer);
router.all('/:sessionId/:port', proxyToContainer);

export default router;
