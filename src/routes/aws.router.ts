import express from 'express';
import { endUserSession, startSession } from '../controller/session.js';
const router = express.Router();

console.log("i am here");


router.post('/startSession', startSession);
router.post('/stopSession', endUserSession)
export default router;