import { Response } from 'express';
import { Project } from '../models/Project';
import { AuthRequest } from '../middleware/auth.middleware';
import { fail } from '../utils/respond';

export const getProjects = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const projects = await Project.find({ userId: req.userId as any }).sort({ name: 1 });
    res.status(200).json(projects);
  } catch (error) {
    fail(res, 500, "We couldn't load your folders. Pull to refresh to try again.", error);
  }
};

export const createProject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, color } = req.body;
    if (!name) {
      res.status(400).json({ message: "Please give the folder a name." });
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
    fail(res, 500, "We couldn't create that folder. Please try again.", error);
  }
};

export const deleteProject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const project = await Project.findOneAndDelete({ _id: id as any, userId: req.userId as any });
    
    if (!project) {
      res.status(404).json({ message: "That folder is no longer available." });
      return;
    }

    // Optional: Update all meetings belonging to this project to have projectId: null
    // await Meeting.updateMany({ projectId: id }, { $unset: { projectId: 1 } });

    res.status(200).json({ message: 'Project deleted successfully' });
  } catch (error) {
    fail(res, 500, "We couldn't delete that folder. Please try again.", error);
  }
};
