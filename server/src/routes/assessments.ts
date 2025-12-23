import { Router } from 'express';
import { AssessmentController } from '../controllers/assessmentController';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = Router();

router.post('/', AssessmentController.create);
router.post('/submit', AssessmentController.submit);  // LCI和其他产品使用的提交路由
router.post('/update-ai', AssessmentController.updateAI);  // 更新AI分析
router.post('/generate-asa-report', AssessmentController.generateASAReport);
router.get('/stats', authenticate, requireAdmin, AssessmentController.getStatistics);
router.get('/list', authenticate, requireAdmin, AssessmentController.list);
router.get('/export', authenticate, requireAdmin, AssessmentController.export);  // 导出评估数据
router.get('/my', authenticate, AssessmentController.getUserAssessments);
router.get('/by-access-code/:accessCodeId', AssessmentController.getByAccessCodeId);  // 通过accessCodeId获取评估结果
router.get('/:id', AssessmentController.getById);

export default router;
