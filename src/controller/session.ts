import type {Request, Response}  from "express";
import { startAndPrepareTask } from "../utils/aws-controller/startTask.js";
import { registerTarget } from "../utils/aws-controller/registerTask.js";
import type { sessionRequestType, sessionStopRequest }  from "../types/types.js";
import { stopUserTask } from "../utils/aws-controller/stopTask.js";
import { deregisterTarget } from "../utils/aws-controller/deregisterTask.js";
import { nanoid } from "nanoid";
import { createSession, deleteSession } from '../repositories/session.repository.js';

export async function startSession(req: Request<{}, {}, sessionRequestType>, res: Response) {
  try {
    const { userId, projectId, projectName } = req.body

    if(!userId){
        console.error("user does not exist");
        return res.status(400).json({ error: "userId is required" });
    }

    if(!projectName){
        console.error("projectName is required");
        return res.status(400).json({ error: "projectName is required" });
    }

    // Generate unique session ID
    const sessionId = nanoid();

    // Use shared access point for all users
    const accessPointId = process.env.SHARED_ACCESS_POINT_ID!;

    if (!accessPointId) {
      return res.status(500).json({ error: "Shared access point not configured" });
    }

    console.log(`Using shared access point: ${accessPointId}`);
    console.log(`Starting session for project: ${projectName} (${projectId || 'new'})`);

    const { taskArn, privateIp } = await startAndPrepareTask(
      userId, 
      sessionId, 
      accessPointId,
      projectName
    );

    await registerTarget(privateIp);

    // Store session in database for proxy routing
    await createSession(sessionId, userId, privateIp, taskArn, projectId, projectName);

    return res.json({
      success: true,
      taskArn: taskArn,
      privateIp: privateIp, 
      sessionId: sessionId,
      projectId: projectId,
      projectName: projectName
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to start session" });
  }
}



export async function endUserSession(
  req: Request<{}, {}, sessionStopRequest>, 
  res: Response
) {
  // Handle sendBeacon requests (body might be a string)
  let sessionId, taskArn, privateIp;
  
  if (typeof req.body === 'string') {
    try {
      const parsed = JSON.parse(req.body);
      sessionId = parsed.sessionId;
      taskArn = parsed.taskArn;
      privateIp = parsed.privateIp;
    } catch (e) {
      console.error('Failed to parse sendBeacon body:', e);
      return res.status(400).json({ error: "Invalid request body" });
    }
  } else {
    sessionId = req.body.sessionId;
    taskArn = req.body.taskArn;
    privateIp = req.body.privateIp;
  }
  
  if (!taskArn) {
    return res.status(400).json({ error: "taskArn is required" });
  }

  if (!privateIp) {
    return res.status(400).json({ error: "privateIp is required" });
  }

  if (!sessionId) {
    return res.status(400).json({ error: "sessionId is required" });
  }

  try {
    console.log(`Ending session ${sessionId} for task ${taskArn}`);
   
    await deregisterTarget(process.env.NEXT_PUBLIC_TARGET_GROUP_ARN!, privateIp);

    const stopResponse = await stopUserTask(taskArn);

    // Delete session from database
    await deleteSession(sessionId);

    return res.json({
      success: true,
      sessionId,
      stopResponse
    });
    
  } catch (error) {
    console.error("Failed to end session:", error);
    return res.status(500).json({ error: "Failed to end session" });
  }
}