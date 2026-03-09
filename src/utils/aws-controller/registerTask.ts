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
  const command = new RegisterTargetsCommand({
    TargetGroupArn: process.env.NEXT_PUBLIC_TARGET_GROUP_ARN!, 
    Targets: [
      {
        Id: taskPrivateIp,
        Port: 8080
      }
    ]
  });

  await elb.send(command);
}catch(err){
    console.log("error occured in register target", err);
}

  
}