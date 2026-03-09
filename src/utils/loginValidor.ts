import { body } from "express-validator"
export const loginValidator = [
    body("email")
    .trim()
    .normalizeEmail()
    .isEmail()
    .withMessage("email is not valid"), 
    
    body("passowrd")
    .trim()
]

