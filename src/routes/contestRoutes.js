import express from 'express';
import { getContestsList, getHackathonsList, getChallengesList } from '../controllers/contestController.js';

const router = express.Router();

router.get('/contests', getContestsList);
router.get('/hackathons', getHackathonsList);
router.get('/challenges', getChallengesList);

export default router;
