import  db from "../db/index.js";
import { users } from "../db/schema.js";
import { eq, sql } from 'drizzle-orm'

export const insertUser = async (name: string, email: string) => { 
    await db.insert(users).values({
        name: name,
        email: email,
        projects: [], 
        accessPointId: ""
    });
}

export const addProject = async (userId: string, project: string) => {
  try {
    await db
      .update(users)
      .set({
        projects: sql`array_append(${users.projects}, ${project})`
      })
      .where(eq(users.userId, userId));
  } catch (error) {
    console.error('Failed to add project to database:', error);
    throw new Error('Database operation failed: Unable to add project');
  }
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
