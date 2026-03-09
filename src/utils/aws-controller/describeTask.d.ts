import 'dotenv/config';
export declare function describeTask(taskArn: string): Promise<import("@aws-sdk/client-ecs").Task | undefined>;
export declare function waitForTaskRunning(taskArn: string): Promise<import("@aws-sdk/client-ecs").Task>;
//# sourceMappingURL=describeTask.d.ts.map