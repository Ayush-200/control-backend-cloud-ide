import { ECSClient, StopTaskCommand } from "@aws-sdk/client-ecs";
import 'dotenv/config';

const ecs = new ECSClient({ region: process.env.NEXT_PUBLIC_REGION! });

export async function stopUserTask(taskArn: string) {
  if (!taskArn) {
    throw new Error("taskArn is required to stop the task");
  }

  const response = await ecs.send(
    new StopTaskCommand({
      cluster: process.env.NEXT_PUBLIC_CLUSTER_ID, // must match the cluster where task was started
      task: taskArn,
      reason: "User session ended"
    })
  );

  return response;
}