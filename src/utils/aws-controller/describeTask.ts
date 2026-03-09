import { ECSClient,  DescribeTasksCommand } from "@aws-sdk/client-ecs";
import 'dotenv/config';
const ecs = new ECSClient({ region: process.env.NEXT_PUBLIC_REGION! });


export async function describeTask(taskArn: string) {
  const command = new DescribeTasksCommand({
    cluster: process.env.NEXT_PUBLIC_CLUSTER_ID!,
    tasks: [taskArn]
  });

  const response = await ecs.send(command);

  if (!response.tasks || response.tasks.length === 0) {
    throw new Error("Task not found");
  }

  return response.tasks[0];
}

export async function waitForTaskRunning(taskArn: string) {
  const maxAttempts = 30;
  const delayMs = 2000;

  for (let i = 0; i < maxAttempts; i++) {
    const task = await describeTask(taskArn);

    if (task?.lastStatus === "RUNNING") {
      return task;
    }

    if (task?.lastStatus === "STOPPED") {
      throw new Error("Task stopped before reaching RUNNING");
    }

    await new Promise(res => setTimeout(res, delayMs));
  }

  throw new Error("Timeout waiting for task to reach RUNNING");
}