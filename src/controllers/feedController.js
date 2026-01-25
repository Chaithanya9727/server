import asyncHandler from "express-async-handler";
import Post from "../models/Post.js";
import { notifyUser } from "../utils/notifyUser.js";
import { isProfane } from "../utils/badWordFilter.js";

// @desc    Get all posts
// @route   GET /api/feed
// @access  Private
export const getFeed = asyncHandler(async (req, res) => {
  const posts = await Post.find({})
    .populate("author", "name avatar role company")
    .populate("comments.user", "name avatar")
    .sort({ createdAt: -1 });
  
  res.json(posts);
});

// @desc    Create a post
// @route   POST /api/feed
// @access  Private
export const createPost = asyncHandler(async (req, res) => {
  const { content, image, tags } = req.body;

  if (!content) {
    res.status(400);
    throw new Error("Content is required");
  }

  if (isProfane(content)) {
    res.status(400);
    throw new Error("Your post contains inappropriate language. Please maintain a professional environment.");
  }

  const post = await Post.create({
    author: req.user._id,
    content,
    image,
    tags
  });

  const populatedPost = await Post.findById(post._id).populate("author", "name avatar role");

  res.status(201).json(populatedPost);
});

// @desc    Delete a post
// @route   DELETE /api/feed/:id
// @access  Private
export const deletePost = asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id);

  if (!post) {
    res.status(404);
    throw new Error("Post not found");
  }

  // Check ownership or admin
  if (post.author.toString() !== req.user._id.toString() && req.user.role !== 'admin' && req.user.role !== 'superadmin') {
     res.status(401);
     throw new Error("Not authorized to delete this post");
  }

  await Post.findByIdAndDelete(req.params.id);
  res.json({ message: "Post removed" });
});

// @desc    Like a post
// @route   PUT /api/feed/:id/like
// @access  Private
export const toggleLike = asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id);

  if (!post) {
    res.status(404);
    throw new Error("Post not found");
  }

  let liked = false;
  if (post.likes.includes(req.user._id)) {
    post.likes = post.likes.filter(id => id.toString() !== req.user._id.toString());
  } else {
    post.likes.push(req.user._id);
    liked = true;
  }

  await post.save();

  if (liked && post.author.toString() !== req.user._id.toString()) {
    await notifyUser({
      userId: post.author,
      title: "New Like on your Post",
      message: `${req.user.name} liked your post.`,
      link: `/community`,
      type: "social",
      emailEnabled: false
    });
  }

  res.json(post.likes);
});

// @desc    Add a comment
// @route   POST /api/feed/:id/comment
// @access  Private
export const addComment = asyncHandler(async (req, res) => {
  const { text } = req.body;
  const post = await Post.findById(req.params.id);

  if (!post) {
    res.status(404);
    throw new Error("Post not found");
  }

  if (isProfane(text)) {
    res.status(400);
    throw new Error("Comment contains inappropriate language.");
  }

  const comment = {
    user: req.user._id,
    text,
    createdAt: new Date()
  };

  post.comments.push(comment);
  await post.save();

  if (post.author.toString() !== req.user._id.toString()) {
    await notifyUser({
      userId: post.author,
      title: "New Comment on your Post",
      message: `${req.user.name} commented: "${text.substring(0, 30)}${text.length > 30 ? '...' : ''}"`,
      link: `/community`,
      type: "social",
      emailEnabled: true,
      emailSubject: "New Comment on your Post",
    });
  }

  const updatedPost = await Post.findById(req.params.id)
    .populate("author", "name avatar role")
    .populate("comments.user", "name avatar");

  res.json(updatedPost);
});

// @desc    Delete a comment
// @route   DELETE /api/feed/:id/comment/:commentId
// @access  Private
export const deleteComment = asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id);

  if (!post) {
    res.status(404);
    throw new Error("Post not found");
  }

  // Find comment manually to check permissions
  // Using loose equality or string conversion to be safe
  const comment = post.comments.find(c => c._id.toString() === req.params.commentId);

  if (!comment) {
    res.status(404);
    throw new Error("Comment not found");
  }

  // Allow comment author, post author, or admin to delete
  if (
    comment.user.toString() !== req.user._id.toString() && 
    post.author.toString() !== req.user._id.toString() &&
    req.user.role !== 'admin' && 
    req.user.role !== 'superadmin'
  ) {
    res.status(401);
    throw new Error("Not authorized");
  }

  // Use filter to remove, compatible with all Mongoose versions
  post.comments = post.comments.filter(c => c._id.toString() !== req.params.commentId);
  
  await post.save();

  const updatedPost = await Post.findById(req.params.id)
    .populate("author", "name avatar role")
    .populate("comments.user", "name avatar");
    
  res.json(updatedPost);
});
