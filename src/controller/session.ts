import type {Request, Response}  from "express";
import { startAndPrepareTask } from "../utils/aws-controller/startTask.js";
import { registerTarget } from "../utils/aws-controller/registerTask.js";
import type { sessionRequestType, sessionStopRequest }  from "../types/types.js";
import { stopUserTask } from "../utils/aws-controller/stopTask.js";
import { deregisterTarget } from "../utils/aws-controller/deregisterTask.js";
import { customAlphabet } from "nanoid";
import { createSession, deleteSession, getSessionByUserAndProject, updateSession, getSessionById } from '../repositories/session.repository.js';
import { storeWorkspaceInRedis, deleteWorkspaceFromRedis } from '../services/workspace.service.js';
import { checkTaskStatus } from '../utils/aws-controller/checkTaskStatus.js';

export async function startSession(req: Request<{}, {}, sessionRequestType>, res: Response) {
  let taskArn: string | undefined;
  let privateIp: string | undefined;
  let sessionId: string | undefined;
  let createdProjectId: string | undefined;
  let projectAddedToDb = false;

  try {
    const { userId, projectId, projectName } = req.body;

    if(!userId){
        console.error("user does not exist");
        return res.status(400).json({ error: "userId is required" });
    }

    if(!projectName){
        console.error("projectName is required");
        return res.status(400).json({ error: "projectName is required" });
    }

    // Check if there's an existing session for this user/project
    const existingSession = await getSessionByUserAndProject(userId, projectId, projectName);
    
    if (existingSession) {
      console.log(`Found existing session: ${existingSession.sessionId}`);
      
      // Stop the old task if it exists
      if (existingSession.taskArn) {
        try {
          console.log(`Stopping old task: ${existingSession.taskArn}`);
          await stopUserTask(existingSession.taskArn);
          await deregisterTarget(process.env.NEXT_PUBLIC_TARGET_GROUP_ARN!, existingSession.privateIp);
        } catch (err) {
          console.warn('Failed to stop old task:', err);
          // Continue anyway - the old task might already be stopped
        }
      }
      
      // Delete the old session from database
      await deleteSession(existingSession.sessionId);
    }

    // Always generate a NEW session ID for each start (lowercase only for DNS compatibility)
    const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 21);
    sessionId = nanoid();

    // Use shared access point for all users
    const accessPointId = process.env.SHARED_ACCESS_POINT_ID!;

    if (!accessPointId) {
      return res.status(500).json({ error: "Shared access point not configured" });
    }

    console.log(`Using shared access point: ${accessPointId}`);
    console.log(`Starting session for project: ${projectName} (${projectId || 'new'})`);

    // Start container FIRST - fail fast if this doesn't work
    const taskResult = await startAndPrepareTask(
      userId, 
      sessionId, 
      accessPointId,
      projectName
    );
    taskArn = taskResult.taskArn;
    privateIp = taskResult.privateIp;

    // Register target and wait for health checks
    const registerResult = await registerTarget(privateIp);
    
    if (!registerResult.success) {
      // TEMPORARY: Don't stop task on health check failure - keep it alive for debugging
      console.error(`⚠️ Health checks failed but keeping task alive for debugging`);
      console.error(`   Task ARN: ${taskArn}`);
      console.error(`   Private IP: ${privateIp}`);
      console.error(`   Session ID: ${sessionId}`);
      console.error(`   Reason: ${registerResult.message}`);
      console.error(`   `);
      console.error(`   To debug, SSH into EC2 in same VPC and run:`);
      console.error(`   curl http://${privateIp}:8080/health`);
      console.error(`   `);
      console.error(`   If that works, the issue is security group or ALB config`);
      console.error(`   If that fails, the container is not responding`);
      
      // Comment out the error throw temporarily
      // throw new Error(registerResult.message);
      
      // Continue anyway for debugging
      console.log(`⚠️ Continuing with unhealthy target for debugging purposes...`);
    } else {
      console.log(`✅ Target registered successfully: ${registerResult.message}`);
    }

    // Store workspace data in Redis for reverse proxy
    await storeWorkspaceInRedis(sessionId, {
      ip: privateIp,
      userId,
      projectName,
      sessionId,
      taskArn
    });
    console.log(`✅ Workspace stored in Redis: workspace:${sessionId}`);

    // If no projectId provided, create new project ONLY after container is running
    if (!projectId) {
      const { addProject } = await import('../repositories/user.repository.js');
      const { nanoid: projectNanoid } = await import('nanoid');
      
      createdProjectId = projectNanoid(10);
      const project = {
        id: createdProjectId,
        name: projectName,
        status: "running",
        sessionId: sessionId,
        createdAt: new Date().toISOString()
      };

      await addProject(userId, JSON.stringify(project));
      projectAddedToDb = true;
      console.log(`✅ Project created: ${projectName} (${createdProjectId}) for user ${userId}`);
    }

    // Create session in database AFTER project (if new project was created)
    console.log(`Creating new session ${sessionId} with IP: ${privateIp}`);
    await createSession(sessionId, userId, privateIp, taskArn, createdProjectId || projectId, projectName);
    console.log(`✅ Session ${sessionId} created successfully`);

    return res.json({
      success: true,
      taskArn: taskArn,
      privateIp: privateIp, 
      sessionId: sessionId,
      projectId: createdProjectId || projectId,
      projectName: projectName
    });

  } catch (err) {
    console.error('❌ Failed to start session:', err);
    
    // Cleanup in reverse order of creation
    
    // 1. Remove project from DB if we added it
    if (projectAddedToDb && createdProjectId) {
      try {
        const { deleteProject } = await import('../repositories/user.repository.js');
        const { getUserById } = await import('../repositories/user.repository.js');
        
        const user = await getUserById(req.body.userId);
        if (user) {
          const projectToDelete = user.projects.find((p: string) => {
            try {
              const project = JSON.parse(p);
              return project.id === createdProjectId;
            } catch {
              return false;
            }
          });
          
          if (projectToDelete) {
            await deleteProject(req.body.userId, projectToDelete);
            console.log('🧹 Cleaned up project from DB');
          }
        }
      } catch (cleanupErr) {
        console.error('Failed to cleanup project:', cleanupErr);
      }
    }

    // 2. Delete session from DB
    if (sessionId) {
      try {
        await deleteSession(sessionId);
        console.log('🧹 Cleaned up session from DB');
      } catch (cleanupErr) {
        console.error('Failed to cleanup session:', cleanupErr);
      }
    }

    // 3. Delete workspace from Redis
    if (sessionId) {
      try {
        await deleteWorkspaceFromRedis(sessionId);
        console.log('🧹 Cleaned up workspace from Redis');
      } catch (cleanupErr) {
        console.error('Failed to cleanup Redis:', cleanupErr);
      }
    }

    // 4. Stop container and deregister from load balancer
    if (taskArn && privateIp) {
      try {
        await deregisterTarget(process.env.NEXT_PUBLIC_TARGET_GROUP_ARN!, privateIp);
        await stopUserTask(taskArn);
        console.log('🧹 Cleaned up AWS resources');
      } catch (cleanupErr) {
        console.error('Failed to cleanup AWS resources:', cleanupErr);
      }
    }
    
    return res.status(500).json({ error: "Failed to start session" });
  }
}



// Store for tracking inactive sessions with timeout
const inactiveSessions = new Map<string, NodeJS.Timeout>();
const GRACE_PERIOD_MS = 30000; // 30 seconds grace period

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
    console.log(`📤 Disconnect signal received for session ${sessionId}`);
    
    // Check if there's already a pending shutdown for this session
    const existingTimeout = inactiveSessions.get(sessionId);
    if (existingTimeout) {
      console.log(`⏳ Session ${sessionId} already marked for shutdown, ignoring duplicate signal`);
      return res.json({
        success: true,
        message: 'Session already marked for shutdown',
        sessionId
      });
    }
    
    // Mark session as inactive and schedule shutdown
    console.log(`⏰ Marking session ${sessionId} as inactive. Will shutdown in ${GRACE_PERIOD_MS/1000}s if no reconnect...`);
    
    const shutdownTimeout = setTimeout(async () => {
      try {
        console.log(`🛑 Grace period expired for session ${sessionId}. Stopping task...`);
        
        // Deregister from load balancer
        await deregisterTarget(process.env.NEXT_PUBLIC_TARGET_GROUP_ARN!, privateIp);
        console.log(`✅ Target deregistered: ${privateIp}`);

        // Stop ECS task
        const stopResponse = await stopUserTask(taskArn);
        console.log(`✅ Task stopped: ${taskArn}`);

        // Delete session from database
        await deleteSession(sessionId);
        console.log(`✅ Session deleted from DB: ${sessionId}`);

        // Delete workspace from Redis
        await deleteWorkspaceFromRedis(sessionId);
        console.log(`✅ Workspace deleted from Redis: workspace:${sessionId}`);
        
        // Remove from inactive sessions map
        inactiveSessions.delete(sessionId);
        
        console.log(`✅ Session ${sessionId} fully cleaned up`);
      } catch (error) {
        console.error(`❌ Error during delayed shutdown for session ${sessionId}:`, error);
        inactiveSessions.delete(sessionId);
      }
    }, GRACE_PERIOD_MS);
    
    // Store the timeout so we can cancel it if user reconnects
    inactiveSessions.set(sessionId, shutdownTimeout);
    
    // Respond immediately - don't wait for shutdown
    return res.json({
      success: true,
      message: `Session marked for shutdown in ${GRACE_PERIOD_MS/1000}s`,
      sessionId,
      gracePeriod: GRACE_PERIOD_MS
    });
    
  } catch (error) {
    console.error("Failed to mark session for shutdown:", error);
    return res.status(500).json({ error: "Failed to process disconnect signal" });
  }
}

/**
 * Cancel pending shutdown if user reconnects
 * Call this when user navigates back to code-editor or socket reconnects
 */
export function cancelSessionShutdown(sessionId: string): boolean {
  const timeout = inactiveSessions.get(sessionId);
  if (timeout) {
    clearTimeout(timeout);
    inactiveSessions.delete(sessionId);
    console.log(`✅ Cancelled pending shutdown for session ${sessionId} - user reconnected`);
    return true;
  }
  return false;
}


export async function checkSessionStatus(
  req: Request<{ sessionId: string }>,
  res: Response
) {
  const { sessionId } = req.params;

  if (!sessionId) {
    return res.status(400).json({ error: "sessionId is required" });
  }

  try {
    // Get session from database
    const session = await getSessionById(sessionId);

    if (!session) {
      return res.status(404).json({ 
        status: 'NOT_FOUND',
        message: 'Session not found'
      });
    }

    // Check task status from ECS
    const taskStatus = await checkTaskStatus(session.taskArn);

    console.log(`📊 Session ${sessionId} status: ${taskStatus}`);

    return res.json({
      status: taskStatus,
      sessionId: session.sessionId,
      taskArn: session.taskArn,
      privateIp: session.privateIp,
      projectName: session.projectName
    });

  } catch (error) {
    console.error('Error checking session status:', error);
    return res.status(500).json({ 
      error: "Failed to check session status",
      details: String(error)
    });
  }
}
