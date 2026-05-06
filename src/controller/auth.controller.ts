import { insertUser, getUserByEmail } from "../repositories/user.repository.js"
import type { Request, Response } from "express";

export const getUserByEmailController = async (req: Request, res: Response) => {
    const { email } = req.body;
    
    console.log('=== getUserByEmail called ===');
    console.log('Email:', email);
    
    try {
        let user = await getUserByEmail(email);
        console.log('User found:', user);
        
        // If user doesn't exist, create them (Auth0 auto-registration)
        if (!user) {
            console.log('User not found in database, creating new user...');
            
            // Extract name from email (before @)
            const name = email.split('@')[0];
            
            // Create user with Auth0 data
            await insertUser(
                name,           // name
                email           // email
            );
            
            // Fetch the newly created user
            user = await getUserByEmail(email);
            console.log('✅ New user created:', user);
        }
        
        if (!user) {
            return res.status(500).json({ error: "Failed to create user" });
        }
        
        console.log('Returning user data:', { userId: user.userId, name: user.name, email: user.email });
        res.status(200).json({ 
            userId: user.userId,
            name: user.name,
            email: user.email 
        });
    } catch (err) {
        console.error('Error fetching/creating user:', err);
        res.status(500).json({ error: "Failed to fetch user", details: String(err) });
    }
}



