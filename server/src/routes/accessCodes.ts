import { Router } from 'express';
import { AccessCodeController } from '../controllers/accessCodeController';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = Router();

router.post('/validate', AccessCodeController.validateCode);
router.post('/generate', authenticate, requireAdmin, AccessCodeController.generateCodes);
router.get('/stats', authenticate, requireAdmin, AccessCodeController.getStats);
router.get('/list', authenticate, requireAdmin, AccessCodeController.listCodes);

export default router;
