import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import {
  getTemplates,
  semanticSearch,
  getEntities,
  getEntityTimeline,
  getCommitments,
  getDecisionDrift,
  getBriefing,
} from '../controllers/intelligence.controller';

const router = Router();
router.use(authMiddleware);

// #8 Templates
router.get('/templates', getTemplates);

// #7 Semantic search
router.get('/search', semanticSearch);

// #5 Pre-meeting briefing
router.get('/briefing', getBriefing);

// #1 Cross-meeting memory
router.get('/memory/entities', getEntities);
router.get('/memory/entities/:name', getEntityTimeline);
router.get('/memory/commitments', getCommitments);
router.get('/memory/drift', getDecisionDrift);

export default router;
