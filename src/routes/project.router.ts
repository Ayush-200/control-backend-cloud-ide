import express from 'express';
import { createProject, getProjects, removeProject } from '../controller/project.controller.js';

const router = express.Router();

router.post('/projects', createProject);
router.get('/projects', getProjects);
router.delete('/projects', removeProject);

export default router;
