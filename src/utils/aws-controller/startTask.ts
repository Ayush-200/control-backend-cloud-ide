import { ECSClient, RunTaskCommand } from "@aws-sdk/client-ecs";
import { waitForTaskRunning } from "./describeTask.js";
import { getPrivateIp } from "./extractPrivateIP.js";
import 'dotenv/config';
const ecs = new ECSClient({ region: process.env.NEXT_PUBLIC_REGION });

export async function startAndPrepareTask(
  userId: string, 
  sessionId: string, 
  accessPointId: string,
  projectName: string
) {
  // Create workspace path: /workspace/{userId}/{projectName}
  const workspacePath = `/workspace/${userId}/${projectName}`;

  console.log(`Creating workspace at: ${workspacePath}`);

  const runResponse = await ecs.send(
    new RunTaskCommand({
      cluster: process.env.NEXT_PUBLIC_CLUSTER_ID,
      taskDefinition: process.env.NEXT_PUBLIC_TASK_DEFINITION_ID,
      launchType: "FARGATE",
      platformVersion: "LATEST",
      networkConfiguration: {
        awsvpcConfiguration: {
          subnets: [
            process.env.NEXT_PUBLIC_SUBNTET_ID1!,
            process.env.NEXT_PUBLIC_SUBNTET_ID2!
          ],
          securityGroups: [process.env.NEXT_PUBLIC_SECURITY_ID!],
          assignPublicIp: "ENABLED"
        }
      },
      overrides: {
        containerOverrides: [
          {
            name: `execution`,
            environment: [
              { name: "USER_ID", value: userId }, 
              { name: "SESSION_ID", value: sessionId },
              { name: "ACCESS_POINT_ID", value: accessPointId },
              { name: "WORKSPACE_PATH", value: workspacePath },
              { name: "PROJECT_NAME", value: projectName }
            ],
            // Command to ensure workspace directory exists and run as root
            command: [
              "sh",
              "-c",
              `mkdir -p ${workspacePath} && chmod -R 777 /workspace && node /app/dist/server.js`
            ]
          }
        ]
      }
    })
  );

  const taskArn = runResponse.tasks?.[0]?.taskArn;

  if (!taskArn) {
    throw new Error("Failed to start task");
  }

  console.log(`✅ Task started: ${taskArn}`);
  console.log(`📁 Workspace: ${workspacePath}`);
  console.log(`🔗 EFS Access Point: ${accessPointId}`);
  console.log(`👤 User: ${userId}`);
  console.log(`📦 Project: ${projectName}`);

  const runningTask = await waitForTaskRunning(taskArn);
  const privateIp = getPrivateIp(runningTask);

  return { taskArn, privateIp };
}