import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { generateToken } from './jwt.js';
import { createRefreshToken } from './createRefreshToken.js';

export const refreshAccessToken = (req: Request, res: Response) => { 
    const refreshToken = req.cookies.Refreshtoken;
    
    if (!refreshToken) {
        return res.status(401).json({ error: "Refresh token not provided" });
    }

    try {
        // Verify the refresh token
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as any;
        
        // Create new tokens
        const payload = {
            userId: decoded.userId,
            email: decoded.email
        };
        
        const newAccessToken = generateToken(payload);
        const newRefreshToken = createRefreshToken(payload);
        
        // Set new tokens in cookies
        res.cookie('accessToken', newAccessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 24 * 60 * 60 * 1000 // 1 day
        });
        
        res.cookie('Refreshtoken', newRefreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });
        
        return res.status(200).json({ 
            message: "Tokens refreshed successfully",
            accessToken: newAccessToken 
        });
        
    } catch (error) {
        return res.status(401).json({ error: "Invalid or expired refresh token" });
    }
}
