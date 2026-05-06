import { ClusterConfiguration$ } from "@aws-sdk/client-ecs";
import 'dotenv/config';
import {
  ElasticLoadBalancingV2Client,
  RegisterTargetsCommand,
  DescribeTargetHealthCommand
} from "@aws-sdk/client-elastic-load-balancing-v2";

const elb = new ElasticLoadBalancingV2Client({
  region: process.env.NEXT_PUBLIC_REGION!
});

interface RegisterTargetResult {
  success: boolean;
  message: string;
  state?: string;
}

export async function registerTarget(
  taskPrivateIp: string
): Promise<RegisterTargetResult> {
  if (!taskPrivateIp) {
    throw new Error("Private IP is required to register target");
  }

  try {
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

    // Wait for target to become healthy
    console.log(`⏳ Waiting for target to become healthy...`);
    const maxAttempts = 30; // 30 attempts = ~1 minute
    const delayMs = 2000; // 2 seconds between checks
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const healthCommand = new DescribeTargetHealthCommand({
        TargetGroupArn: process.env.NEXT_PUBLIC_TARGET_GROUP_ARN!,
        Targets: [
          {
            Id: taskPrivateIp,
            Port: 8080
          }
        ]
      });

      const healthResponse = await elb.send(healthCommand);
      const targetHealth = healthResponse.TargetHealthDescriptions?.[0];
      const state = targetHealth?.TargetHealth?.State;

      console.log(`🔍 Health check attempt ${attempt}/${maxAttempts}: ${state}`);

      if (state === 'healthy') {
        console.log(`✅ Target is healthy and ready to serve traffic!`);
        return {
          success: true,
          message: 'Target registered and healthy',
          state: 'healthy'
        };
      }

      if (state === 'unhealthy') {
        const reason = targetHealth?.TargetHealth?.Reason;
        const description = targetHealth?.TargetHealth?.Description;
        console.warn(`⚠️ Target is unhealthy: ${reason} - ${description}`);
        
        // Common reasons and what they mean:
        // - Target.ResponseCodeMismatch: Health check got wrong status code
        // - Target.Timeout: Health check timed out (container not responding)
        // - Target.FailedHealthChecks: Multiple consecutive failures
        // - Elb.InitialHealthChecking: Still in initial health check phase
        
        // If explicitly unhealthy (not just initializing), fail fast
        if (reason === 'Target.FailedHealthChecks') {
          console.error(`❌ Target failed health checks after multiple attempts`);
          console.error(`   This usually means:`);
          console.error(`   1. Container is not responding on port 8080`);
          console.error(`   2. Security group is blocking ALB health checks`);
          console.error(`   3. Health check path /health is not accessible`);
          return {
            success: false,
            message: `Target failed health checks: ${description}`,
            state: 'unhealthy'
          };
        }
      }

      if (state === 'initial') {
        console.log(`⏳ Target still initializing...`);
      }

      if (state === 'draining') {
        console.warn(`⚠️ Target is draining (being deregistered)`);
      }

      // Wait before next check
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    // If we get here, target didn't become healthy in time
    console.warn(`⚠️ Target registered but not healthy after ${maxAttempts} attempts`);
    return {
      success: false,
      message: 'Target registration timeout - container did not become healthy',
      state: 'timeout'
    };
    
  } catch (err) {
    console.error("❌ Error occurred in register target:", err);
    return {
      success: false,
      message: `Failed to register target: ${err}`,
      state: 'error'
    };
  }
}