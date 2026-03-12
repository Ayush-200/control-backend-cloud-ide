import express from 'express';
import {loginValidator} from '../utils/loginValidor'
import { signupValidator } from '../utils/singupValidator';
import validateErrors from '../utils/validateErrors';
import { loginUserController, signupUserController, getUserByEmailController } from '../controller/auth.controller';
import { refreshAccessToken } from '../utils/refreshAccessToken'
const router = express.Router();

router.post("/login", loginValidator, validateErrors, loginUserController);

router.post('/signup', signupValidator, validateErrors, signupUserController);

router.post('/user', getUserByEmailController);

router.post('/refresh', refreshAccessToken);

export default router;