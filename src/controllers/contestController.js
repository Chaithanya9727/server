import { getContests, getHackathons } from '../services/contestService.js';
import { getAggregatedChallenges } from '../services/challengesService.js';
import asyncHandler from 'express-async-handler';

// @desc    Get all active/upcoming contests
// @route   GET /api/contests
// @access  Public
export const getContestsList = asyncHandler(async (req, res) => {
  const contests = await getContests();
  res.json(contests);
});

// @desc    Get all hackathons
// @route   GET /api/hackathons
// @access  Public
export const getHackathonsList = asyncHandler(async (req, res) => {
  const hackathons = await getHackathons();
  res.json(hackathons);
});

// @desc    Get all challenges (POTD)
// @route   GET /api/challenges
// @access  Public
export const getChallengesList = asyncHandler(async (req, res) => {
  const challenges = await getAggregatedChallenges();
  res.json(challenges);
});
