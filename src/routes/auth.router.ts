import express from 'express';
import { getUserByEmailController } from '../controller/auth.controller.js';

const router = express.Router();

// Only keep the Auth0 integration endpoint
router.post('/user', getUserByEmailController);

export default router;
