import jwt from "jsonwebtoken"
export const createRefreshToken = (payload: Object) => {
    return jwt.sign(payload, process.env.JWT_REFRESH_SECRET!);
}