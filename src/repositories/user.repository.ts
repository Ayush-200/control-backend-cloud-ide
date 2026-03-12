import  db from "../db/index.js";
import { users } from "../db/schema.js";
import { eq, sql } from 'drizzle-orm'

export const insertUser = async (name: string, email: string, password: string, refreshToken: string) => { 
    await db.insert(users).values({
        name: name,
        email: email,
        password: password,
        projects: [], 
        refreshToken: refreshToken,
        accessPointId: ""
    });
}

export const addProject = async (userId: string, project: string) => {
   await db
  .update(users)
  .set({
    projects: sql`array_append(${users.projects}, ${project})`
  })
  .where(eq(users.userId, userId));
}


export const deleteProject = async (userId: string, project: string) => {
    await db
  .update(users)
  .set({
    projects: sql`array_remove(${users.projects}, ${project})`
  })
  .where(eq(users.userId, userId));
}

export const deleteUser = async (userId: string) => {
    await db
        .delete(users)
        .where(eq(users.userId, userId));
}

export const getUserById = async (userId: string) => {
    const result = await db
        .select()
        .from(users)
        .where(eq(users.userId, userId))
        .limit(1);
    
    return result[0] || null;
}

export const getUserByEmail = async (email: string) => {
    const result = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
    
    return result[0] || null;
}

export const updateRefreshToken = async (userId: string, refreshToken: string) => {
    await db
        .update(users)
        .set({ refreshToken: refreshToken })
        .where(eq(users.userId, userId));
}
