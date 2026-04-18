import { ClusterConfiguration$ } from "@aws-sdk/client-ecs";
import 'dotenv/config';
import {
  ElasticLoadBalancingV2Client,
  RegisterTargetsCommand
} from "@aws-sdk/client-elastic-load-balancing-v2";

const elb = new ElasticLoadBalancingV2Client({
  region: process.env.NEXT_PUBLIC_REGION!
});

export async function registerTarget(
  taskPrivateIp: string
): Promise<void> {
  if (!taskPrivateIp) {
    throw new Error("Private IP is required to register target");
  }

  try{
  console.log(`🎯 Registering target with IP: ${taskPrivateIp} to port 8080`);
  console.log(`📋 Target Group ARN: ${process.env.NEXT_PUBLIC_TARGET_GROUP_ARN}`);
  
  const command = new RegisterTargetsCommand({
    TargetGroupArn: process.env.NEXT_PUBLIC_TARGET_GROUP_ARN!, 
    Targets: [
      {
        Id: taskPrivateIp,
        Port: 8080
      }
    ]
  });

  const response = await elb.send(command);
  console.log(`✅ Target registered successfully:`, response);
}catch(err){
    console.error("❌ Error occurred in register target:", err);
    throw err; // Re-throw to see the error in session controller
}

  
}