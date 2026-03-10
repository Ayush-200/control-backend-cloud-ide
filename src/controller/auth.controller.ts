import { insertUser, getUserByEmail } from "../repositories/user.repository.js"
import db from '../db/index.js'
import { eq } from "drizzle-orm";
import { users } from "../db/schema.js";
import { loginUser, signupUser } from "../services/auth.service.js";
import { generateToken } from "../utils/jwt.js";
import { createRefreshToken } from "../utils/createRefreshToken.js";

export const signupUserController = async (req: any, res: any) => {
    const { name, email, password} = req.body;
    try{
        const user = await db.select().from(users).where(eq(users.email, email));
        await db.update(users).set({refreshToken: ""}).where(eq(users.email, email))
        if(user.length === 0){
            res.status(500).json("user already exist");
        }
        signupUser({name, email, password});

        const token = generateToken({name, email, password});
        const refreshToken = createRefreshToken(user[0]);
        res.cookie("access-token", token, {
            httpOnly: true,
            secure: true, 
            maxAge: 15* 60* 1000
        })

          res.cookie("refresh-token", refreshToken, {
            httpOnly: true, 
            secure: true,
            maxAge: 7 * 24* 60* 60* 1000
        })

    }
    catch(err){
        res.status(500).json("unable to signup", err); 
    }
}

export const loginUserController = async (req: any, res: any)  => {
    const { email, password } = req.body;
    try{
        const {token, refreshToken, userId} = await loginUser(email, password);
        res.cookie("access-token", token, {
            httpOnly: true, 
            secure: true, 
            maxAge: 15* 60* 1000
        })

        res.cookie("refresh-token", refreshToken, {
            httpOnly: true, 
            secure: true,
            maxAge: 7 * 24* 60* 60* 1000
        })
        
        res.status(200).json({ success: true, userId });
    }catch(err){
        res.status(500).json("login failed", err);
    }
}

export const getUserByEmailController = async (req: any, res: any) => {
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
                email,          // email
                '',             // password (empty for OAuth users)
                ''              // refreshToken (empty initially)
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


