import express from 'express';
import { proxyToContainer, getSessionInfo } from '../controller/proxy.controller.js';

const router = express.Router();

// Debug endpoint to check session info
router.get('/debug', getSessionInfo);

// ✅ Proxy route — /*path wildcard se saare nested paths catch honge
// Jaise: /5173, /5173/, /5173/@vite/client, /5173/src/main.jsx
router.all('/:port/*path', proxyToContainer);
router.all('/:port', proxyToContainer);

export default router;
