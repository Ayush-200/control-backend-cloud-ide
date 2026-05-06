import { auth } from 'express-oauth2-jwt-bearer';
import { Request, Response, NextFunction } from 'express';

// Verify Auth0 JWT tokens
export const checkAuth0Token = auth({
    audience: process.env.AUTH0_AUDIENCE,
    issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}/`,
    tokenSigningAlg: 'RS256'
});

// Extract user info from verified token
export const extractUserFromToken = (req: Request, res: Response, next: NextFunction) => {
    // After checkAuth0Token runs, req.auth contains the verified token payload
    const auth = (req as any).auth;
    
    if (!auth || !auth.payload) {
        return res.status(401).json({ error: 'Invalid token' });
    }
    
    // Extract user ID from Auth0 token
    // Auth0 tokens have 'sub' (subject) field with user ID
    const userId = auth.payload.sub;
    
    // Attach to request for use in controllers
    (req as any).userId = userId;
    (req as any).userEmail = auth.payload.email;
    
    next();
};
