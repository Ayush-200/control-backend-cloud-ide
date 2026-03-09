import jwt from "jsonwebtoken";

const JWT_SECRET = String(process.env.JWT_SECRET);

export const generateToken = (payload: Object) => {
    return jwt.sign(payload, JWT_SECRET, {expiresIn: "1d"});
}

export const validateToken = (token: string) => { 
    return jwt.verify(token, JWT_SECRET);
}