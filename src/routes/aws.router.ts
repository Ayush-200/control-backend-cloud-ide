import express from 'express';
import { endUserSession, startSession, checkSessionStatus, cancelSessionShutdown } from '../controller/session.js';

const router = express.Router();

console.log("i am here");

// Session management routes
// Note: Auth0 JWT verification removed - frontend uses Auth0 OAuth but doesn't send JWT tokens
// User authentication is handled by userId in request body
router.post('/startSession', startSession);
router.post('/stopSession', endUserSession);
router.post('/cancelShutdown', (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId is required' });
  }
  
  const cancelled = cancelSessionShutdown(sessionId);
  res.json({ 
    success: true, 
    cancelled,
    message: cancelled ? 'Shutdown cancelled' : 'No pending shutdown found'
  });
});
router.get('/session-status/:sessionId', checkSessionStatus);

export default router;