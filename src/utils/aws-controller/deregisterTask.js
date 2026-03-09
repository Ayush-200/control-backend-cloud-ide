import { ElasticLoadBalancingV2Client, DeregisterTargetsCommand } from "@aws-sdk/client-elastic-load-balancing-v2";
const elb = new ElasticLoadBalancingV2Client({
    region: process.env.NEXT_PUBLIC_REGION // must match your ALB region
});
export async function deregisterTarget(targetGroupArn, taskPrivateIp, port = Number(process.env.PORT)) {
    if (!targetGroupArn) {
        throw new Error("targetGroupArn is required");
    }
    if (!taskPrivateIp) {
        throw new Error("taskPrivateIp is required");
    }
    const response = await elb.send(new DeregisterTargetsCommand({
        TargetGroupArn: targetGroupArn,
        Targets: [
            {
                Id: taskPrivateIp,
                Port: port
            }
        ]
    }));
    return response;
}
//# sourceMappingURL=deregisterTask.js.map