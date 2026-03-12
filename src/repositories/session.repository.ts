import db from "../db/index.js";
import { sessions } from "../db/schema.js";
import { eq, desc } from 'drizzle-orm';

export const createSession = async (
  sessionId: string,
  userId: string,
  privateIp: string,
  taskArn: string,
  projectId?: string,
  projectName?: string
) => {
  await db.insert(sessions).values({
    sessionId,
    userId,
    privateIp,
    taskArn,
    projectId: projectId || null,
    projectName: projectName || null
  });
};

export const getSessionById = async (sessionId: string) => {
  const result = await db
    .select()
    .from(sessions)
    .where(eq(sessions.sessionId, sessionId))
    .limit(1);
  
  return result[0] || null;
};

export const getSessionsByUserId = async (userId: string) => {
  return await db
    .select()
    .from(sessions)
    .where(eq(sessions.userId, userId));
};

export const deleteSession = async (sessionId: string) => {
  await db
    .delete(sessions)
    .where(eq(sessions.sessionId, sessionId));
};

export const deleteSessionsByUserId = async (userId: string) => {
  await db
    .delete(sessions)
    .where(eq(sessions.userId, userId));
};

export const updateSessionIp = async (sessionId: string, newPrivateIp: string) => {
  await db
    .update(sessions)
    .set({ privateIp: newPrivateIp })
    .where(eq(sessions.sessionId, sessionId));
};

export const getSessionByUserAndProject = async (userId: string, projectId?: string, projectName?: string) => {
  const baseQuery = db.select().from(sessions).where(eq(sessions.userId, userId));
    
  if (projectId) {
    const result = await baseQuery.where(eq(sessions.projectId, projectId)).limit(1);
    return result[0] || null;
  } else if (projectName) {
    const result = await baseQuery.where(eq(sessions.projectName, projectName)).limit(1);
    return result[0] || null;
  }
  
  // If no projectId or projectName, return the most recent session for the user
  const result = await baseQuery.orderBy(desc(sessions.updatedAt)).limit(1);
  return result[0] || null;
};

export const updateSession = async (
  sessionId: string,
  privateIp: string,
  taskArn: string
) => {
  await db
    .update(sessions)
    .set({ 
      privateIp,
      taskArn,
      updatedAt: new Date()
    })
    .where(eq(sessions.sessionId, sessionId));
};
