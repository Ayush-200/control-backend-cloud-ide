import { ECSClient, DescribeTasksCommand } from "@aws-sdk/client-ecs";
import 'dotenv/config';

const ecs = new ECSClient({
  region: process.env.NEXT_PUBLIC_REGION!
});

export type TaskStatus = 'STARTING' | 'RUNNING' | 'HEALTHY' | 'UNHEALTHY' | 'STOPPED' | 'NOT_FOUND';

export async function checkTaskStatus(taskArn: string): Promise<TaskStatus> {
  try {
    const command = new DescribeTasksCommand({
      cluster: process.env.NEXT_PUBLIC_CLUSTER_ID!,
      tasks: [taskArn]
    });

    const response = await ecs.send(command);
    
    if (!response.tasks || response.tasks.length === 0) {
      return 'NOT_FOUND';
    }

    const task = response.tasks[0];
    
    // Check if task is stopped
    if (task.lastStatus === 'STOPPED') {
      return 'STOPPED';
    }

    // Check if task is still starting
    if (task.lastStatus !== 'RUNNING') {
      return 'STARTING';
    }

    // Task is running, check container health
    const container = task.containers?.[0];
    
    if (!container) {
      return 'RUNNING';
    }

    const healthStatus = container.healthStatus;

    // Map ECS health status to our status
    if (healthStatus === 'HEALTHY') {
      return 'HEALTHY';
    } else if (healthStatus === 'UNHEALTHY') {
      return 'UNHEALTHY';
    } else {
      // UNKNOWN or undefined - container is running but health not determined yet
      return 'RUNNING';
    }

  } catch (error) {
    console.error('Error checking task status:', error);
    return 'NOT_FOUND';
  }
}
