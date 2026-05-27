import { Response } from 'express';
import { Project } from '../models/Project';
import { AuthRequest } from '../middleware/auth.middleware';

export const getProjects = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const projects = await Project.find({ userId: req.userId as any }).sort({ name: 1 });
    res.status(200).json(projects);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching projects', error });
  }
};

export const createProject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, color } = req.body;
    if (!name) {
      res.status(400).json({ message: 'Project name is required' });
      return;
    }

    const newProject = new Project({
      userId: req.userId,
      name,
      color: color || '#007AFF',
    });

    const savedProject = await newProject.save();
    res.status(201).json(savedProject);
  } catch (error) {
    res.status(500).json({ message: 'Error creating project', error });
  }
};

export const deleteProject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const project = await Project.findOneAndDelete({ _id: id as any, userId: req.userId as any });
    
    if (!project) {
      res.status(404).json({ message: 'Project not found' });
      return;
    }

    // Optional: Update all meetings belonging to this project to have projectId: null
    // await Meeting.updateMany({ projectId: id }, { $unset: { projectId: 1 } });

    res.status(200).json({ message: 'Project deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting project', error });
  }
};
