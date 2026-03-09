import { ECSClient, RunTaskCommand } from "@aws-sdk/client-ecs";
import { waitForTaskRunning } from "./describeTask.js";
import { getPrivateIp } from "./extractPrivateIP.js";
import 'dotenv/config';
const ecs = new ECSClient({ region: "ap-south-1" });
export async function startAndPrepareTask(userId) {
    const runResponse = await ecs.send(new RunTaskCommand({
        cluster: process.env.NEXT_PUBLIC_CLUSTER_ID,
        taskDefinition: process.env.NEXT_PUBLIC_TASK_DEFINITION_ID,
        launchType: "FARGATE",
        platformVersion: "LATEST",
        networkConfiguration: {
            awsvpcConfiguration: {
                subnets: [
                    process.env.NEXT_PUBLIC_SUBNTET_ID1,
                    process.env.NEXT_PUBLIC_SUBNTET_ID2
                ],
                securityGroups: [process.env.NEXT_PUBLIC_SECURITY_ID],
                assignPublicIp: "DISABLED"
            }
        },
        overrides: {
            containerOverrides: [
                {
                    name: process.env.NEXT_PUBLIC_CLUSTER_ID,
                    environment: [
                        { name: "USER_ID", value: userId }
                    ]
                }
            ]
        }
    }));
    const taskArn = runResponse.tasks?.[0]?.taskArn;
    if (!taskArn) {
        throw new Error("Failed to start task");
    }
    const runningTask = await waitForTaskRunning(taskArn);
    const privateIp = getPrivateIp(runningTask);
    return { taskArn, privateIp };
}
//# sourceMappingURL=startTask.js.map