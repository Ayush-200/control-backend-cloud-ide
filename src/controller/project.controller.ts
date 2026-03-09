import type { Request, Response } from "express";
import { addProject, deleteProject, getUserById } from "../repositories/user.repository.js";
import { nanoid } from "nanoid";

export const createProject = async (req: Request, res: Response) => {
  try {
    const { userId, projectName } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    if (!projectName) {
      return res.status(400).json({ error: "projectName is required" });
    }

    // Generate unique project ID
    const projectId = nanoid(10);
    const project = {
      id: projectId,
      name: projectName,
      createdAt: new Date().toISOString()
    };

    // Add project to user's projects array
    await addProject(userId, JSON.stringify(project));

    console.log(`Project created: ${projectName} (${projectId}) for user ${userId}`);

    return res.status(201).json({
      success: true,
      project
    });
  } catch (err) {
    console.error("Failed to create project:", err);
    return res.status(500).json({ error: "Failed to create project" });
  }
};

export const getProjects = async (req: Request, res: Response) => {
  try {
    const { userId } = req.query;

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: "userId is required" });
    }

    const user = await getUserById(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Parse projects from string array to objects
    const projects = user.projects.map((p: string) => {
      try {
        return JSON.parse(p);
      } catch {
        return null;
      }
    }).filter(Boolean);

    return res.json({
      success: true,
      projects
    });
  } catch (err) {
    console.error("Failed to get projects:", err);
    return res.status(500).json({ error: "Failed to get projects" });
  }
};

export const removeProject = async (req: Request, res: Response) => {
  try {
    const { userId, projectId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    if (!projectId) {
      return res.status(400).json({ error: "projectId is required" });
    }

    const user = await getUserById(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Find the project to delete
    const projectToDelete = user.projects.find((p: string) => {
      try {
        const project = JSON.parse(p);
        return project.id === projectId;
      } catch {
        return false;
      }
    });

    if (!projectToDelete) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Delete project from user's projects array
    await deleteProject(userId, projectToDelete);

    console.log(`Project deleted: ${projectId} for user ${userId}`);

    return res.json({
      success: true,
      message: "Project deleted successfully"
    });
  } catch (err) {
    console.error("Failed to delete project:", err);
    return res.status(500).json({ error: "Failed to delete project" });
  }
};
