import { body } from "express-validator"
export const signupValidator = [
    body("name")
    .trim()
    .notEmpty()
    .withMessage("name cannot be empty")
    .isLength({min: 2, max: 20})
    .withMessage("name is too long or too short")
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage("name is not valid"), 

    body("email")
    .trim()
    .normalizeEmail()
    .isEmail()
    .withMessage("email is not valid"),

    body("password")
    .trim()
    .isLength({min: 8})
    .withMessage("password must be atleast of 8 length")
    .isStrongPassword()
    .withMessage("passowrd is not strong")
]


