import { Response } from 'express';
import { AssessmentService } from '../services/assessmentService';
import { DeepSeekService } from '../services/deepseekService';
import { AuthRequest } from '../middleware/auth';
import { z } from 'zod';
import prisma from '../config/database';

const createAssessmentSchema = z.object({
  accessCode: z.string(),
  totalScore: z.number().min(0).max(100),
  category: z.string(),
  attachmentStyle: z.string(),
  dimensions: z.array(z.any()),
  answers: z.record(z.number()),
});

// Schema for /submit endpoint (supports LCI, LHI, ASA)
const submitAssessmentSchema = z.object({
  accessCode: z.string(),
  productType: z.enum(['LHI', 'LCI', 'ASA']).default('LHI'),
  totalScore: z.number(),
  category: z.string(),
  attachmentStyle: z.string().optional(),  // Optional for LCI
  dimensions: z.any(),  // Can be array or object
  answers: z.any(),     // Can be object with number or string keys
});

export class AssessmentController {
  static async create(req: AuthRequest, res: Response) {
    try {
      const data = createAssessmentSchema.parse(req.body);
      
      const assessment = await AssessmentService.createAssessment({
        ...data,
        userId: req.user?.id,
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
      });

      res.status(201).json(assessment);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async getById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const assessment = await AssessmentService.getAssessmentById(id);

      if (!assessment) {
        return res.status(404).json({ error: 'Assessment not found' });
      }

      res.json(assessment);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async getByAccessCodeId(req: AuthRequest, res: Response) {
    try {
      const { accessCodeId } = req.params;
      const assessment = await AssessmentService.getAssessmentByAccessCodeId(accessCodeId);

      if (!assessment) {
        return res.status(404).json({ error: 'Assessment not found' });
      }

      res.json(assessment);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async getUserAssessments(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const assessments = await AssessmentService.getUserAssessments(req.user.id);
      res.json(assessments);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async getStatistics(req: AuthRequest, res: Response) {
    try {
      const productType = req.query.productType as string | undefined;
      const stats = await AssessmentService.getStatistics(productType);
      res.json(stats);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async list(req: AuthRequest, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const productType = req.query.productType as string | undefined;

      const result = await AssessmentService.listAssessments(page, limit, productType);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  // ASA 深度报告生成
  static async generateASAReport(req: AuthRequest, res: Response) {
    try {
      const { scores, primaryType, answerSummary, accessCodeId } = req.body;

      if (!scores || !primaryType) {
        return res.status(400).json({ error: '缺少必要参数' });
      }

      const result = await DeepSeekService.generateASAReport({
        scores,
        primaryType,
        answerSummary: answerSummary || '',
        accessCodeId,
        ipAddress: req.ip || req.socket.remoteAddress
      });

      res.json(result);
    } catch (error: any) {
      console.error('Generate ASA report error:', error);
      res.status(500).json({
        success: false,
        error: '生成报告失败，请稍后重试'
      });
    }
  }

  // LCI/LHI/ASA 通用提交接口 (与Vercel serverless函数兼容)
  static async submit(req: AuthRequest, res: Response) {
    try {
      console.log('=== SUBMIT ASSESSMENT START ===');
      const data = submitAssessmentSchema.parse(req.body);
      console.log('Request body:', {
        accessCode: data.accessCode,
        productType: data.productType,
        totalScore: data.totalScore,
        category: data.category
      });

      // 转换answers为正确的格式
      const normalizedAnswers: Record<number, number> = {};
      if (data.answers && typeof data.answers === 'object') {
        Object.entries(data.answers).forEach(([key, value]) => {
          normalizedAnswers[parseInt(key)] = typeof value === 'number' ? value : parseInt(value as string);
        });
      }

      // 转换dimensions为数组格式
      const dimensionsArray = Array.isArray(data.dimensions)
        ? data.dimensions
        : Object.entries(data.dimensions || {}).map(([name, score]) => ({ name, score }));

      const assessment = await AssessmentService.createAssessment({
        accessCode: data.accessCode,
        productType: data.productType as any,
        totalScore: data.totalScore,
        category: data.category,
        attachmentStyle: data.attachmentStyle,
        dimensions: dimensionsArray,
        answers: normalizedAnswers,
        userId: req.user?.id,
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
      });

      console.log('=== SUBMIT ASSESSMENT SUCCESS ===');
      console.log('Assessment ID:', assessment.id);

      res.status(200).json({
        id: assessment.id,
        productType: assessment.productType,
        totalScore: assessment.totalScore,
        category: assessment.category,
        attachmentStyle: assessment.attachmentStyle,
        dimensions: assessment.dimensions,
        aiAnalysis: assessment.aiAnalysis
      });
    } catch (error: any) {
      console.error('=== SUBMIT ASSESSMENT ERROR ===');
      console.error('Error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  // 更新AI分析 (用于LCI保存前端生成的AI报告)
  static async updateAI(req: AuthRequest, res: Response) {
    try {
      const { assessmentId, aiAnalysis } = req.body;

      if (!assessmentId || !aiAnalysis) {
        return res.status(400).json({ error: 'assessmentId and aiAnalysis are required' });
      }

      const assessment = await prisma.assessment.update({
        where: { id: assessmentId },
        data: { aiAnalysis: typeof aiAnalysis === 'string' ? aiAnalysis : JSON.stringify(aiAnalysis) }
      });

      console.log('AI analysis updated for assessment:', assessmentId);

      res.json({ success: true, id: assessment.id });
    } catch (error: any) {
      console.error('Update AI error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  // 导出评估数据
  static async export(req: AuthRequest, res: Response) {
    try {
      const { productType, startDate, endDate } = req.query;

      // Build where clause
      const whereClause: any = {};
      if (productType) {
        whereClause.productType = productType as string;
      }
      if (startDate || endDate) {
        whereClause.createdAt = {};
        if (startDate) {
          whereClause.createdAt.gte = new Date(startDate as string);
        }
        if (endDate) {
          whereClause.createdAt.lte = new Date(endDate as string);
        }
      }

      // Fetch assessments with access code info
      const assessments = await prisma.assessment.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        include: {
          accessCode: {
            select: {
              code: true
            }
          }
        }
      });

      // Format data for export
      const exportData = assessments.map(a => ({
        id: a.id,
        productType: a.productType,
        totalScore: a.totalScore,
        category: a.category,
        attachmentStyle: a.attachmentStyle || '',
        accessCode: a.accessCode?.code || '',
        createdAt: a.createdAt.toISOString(),
        dimensions: a.dimensions || ''
      }));

      res.json({
        success: true,
        count: exportData.length,
        data: exportData
      });
    } catch (error: any) {
      console.error('Export error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}
