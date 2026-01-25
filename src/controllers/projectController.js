import asyncHandler from "express-async-handler";
import Project from "../models/Project.js";

// @desc    Get all projects
// @route   GET /api/projects
// @access  Public
export const getProjects = asyncHandler(async (req, res) => {
  const projects = await Project.find({})
    .populate("author", "name avatar role")
    .sort({ createdAt: -1 });

  res.json(projects);
});

// @desc    Create project
// @route   POST /api/projects
// @access  Private
export const createProject = asyncHandler(async (req, res) => {
  const { title, description, image, tags, repoLink, demoLink } = req.body;

  if (!title || !description || !image) {
    res.status(400);
    throw new Error("Title, description, and image are required");
  }

  const project = await Project.create({
    author: req.user._id,
    title,
    description,
    image,
    tags,
    repoLink,
    demoLink
  });

  res.status(201).json(project);
});

import { notifyUser } from "../utils/notifyUser.js";

// ... (getProjects, createProject)

// @desc    Like project
// @route   PUT /api/projects/:id/like
// @access  Private
// ...
export const likeProject = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id);

  if (!project) {
    res.status(404);
    throw new Error("Project not found");
  }

  let liked = false;
  if (project.likes.includes(req.user._id)) {
    project.likes = project.likes.filter(id => id.toString() !== req.user._id.toString());
  } else {
    project.likes.push(req.user._id);
    liked = true;
  }

  await project.save();

  // Notify Owner if Liked
  if (liked && project.author.toString() !== req.user._id.toString()) {
     await notifyUser({
        userId: project.author,
        title: "Project Appreciation",
        message: `${req.user.name} liked your project "${project.title}".`,
        link: `/projects`,
        type: "social",
        emailEnabled: false
     });
  }

  res.json(project.likes);
});
