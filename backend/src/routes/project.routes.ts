import { Router } from 'express';
import { getProjects, createProject, deleteProject } from '../controllers/project.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/', getProjects);
router.post('/', createProject);
router.delete('/:id', deleteProject);

export default router;
