import db from "../db/index.js";
import { sessions } from "../db/schema.js";
import { eq } from 'drizzle-orm';

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
