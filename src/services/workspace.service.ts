import redis from '../utils/redis.js';

export interface WorkspaceData {
  ip: string;
  userId: string;
  projectName: string;
  sessionId: string;
  taskArn: string;
}

export async function storeWorkspaceInRedis(
  workspaceId: string,
  data: WorkspaceData
): Promise<void> {
  try {
    await redis.set(
      `workspace:${workspaceId}`,
      JSON.stringify(data)
    );
    console.log(`✅ Stored workspace in Redis: workspace:${workspaceId}`);
  } catch (error) {
    console.error('❌ Failed to store workspace in Redis:', error);
    throw error;
  }
}

export async function getWorkspaceFromRedis(
  workspaceId: string
): Promise<WorkspaceData | null> {
  try {
    const data = await redis.get(`workspace:${workspaceId}`);
    if (!data) {
      console.warn(`⚠️ Workspace not found in Redis: workspace:${workspaceId}`);
      return null;
    }
    return JSON.parse(data);
  } catch (error) {
    console.error('❌ Failed to retrieve workspace from Redis:', error);
    throw error;
  }
}

export async function deleteWorkspaceFromRedis(
  workspaceId: string
): Promise<void> {
  try {
    await redis.del(`workspace:${workspaceId}`);
    console.log(`✅ Deleted workspace from Redis: workspace:${workspaceId}`);
  } catch (error) {
    console.error('❌ Failed to delete workspace from Redis:', error);
    throw error;
  }
}


export async function updateWorkspaceIpInRedis(
  workspaceId: string,
  newIp: string
): Promise<void> {
  try {
    const existingData = await getWorkspaceFromRedis(workspaceId);
    if (!existingData) {
      throw new Error(`Workspace ${workspaceId} not found in Redis`);
    }
    
    existingData.ip = newIp;
    await redis.set(
      `workspace:${workspaceId}`,
      JSON.stringify(existingData)
    );
    console.log(`✅ Updated workspace IP in Redis: workspace:${workspaceId} -> ${newIp}`);
  } catch (error) {
    console.error('❌ Failed to update workspace IP in Redis:', error);
    throw error;
  }
}
