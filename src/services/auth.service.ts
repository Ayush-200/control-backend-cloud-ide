import db from '../db';
import { users } from '../db/schema.js';
import { insertUser } from '../repositories/user.repository.js';
import type {signupDataType} from '../types/types';
import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { generateToken } from '../utils/jwt';
import { createRefreshToken } from '../utils/createRefreshToken';

export const signupUser = (data: signupDataType) => { 
    const password = data.password;
    const email = data.email;
    const name = data.name;
    const hashedPassword = String(bcrypt.hash(password, 10));
    try{
        const refreshToken = createRefreshToken(data);
        insertUser(name, email, hashedPassword, refreshToken);
        return ("user inserted into database");
    }catch(error){
        throw new Error(String(error));
    }
}

export async function loginUser (email: string, password: string):Promise<{token: string, refreshToken: string, userId: string}> {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await db.select().from(users).where(eq(users.email, email));
    if(hashedPassword === user[0].password){
        const token = generateToken({user}) || "";
        const refreshToken = createRefreshToken(user[0]) || "";        
        return { token, refreshToken, userId: user[0].userId };
    }
    throw new Error("unable to find user");
}
