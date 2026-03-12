import express from 'express';
import {loginValidator} from '../utils/loginValidor.js'
import { signupValidator } from '../utils/singupValidator.js';
import validateErrors from '../utils/validateErrors.js';
import { loginUserController, signupUserController, getUserByEmailController } from '../controller/auth.controller.js';
import { refreshAccessToken } from '../utils/refreshAccessToken.js'
const router = express.Router();

router.post("/login", loginValidator, validateErrors, loginUserController);

router.post('/signup', signupValidator, validateErrors, signupUserController);

router.post('/user', getUserByEmailController);

router.post('/refresh', refreshAccessToken);

export default router;