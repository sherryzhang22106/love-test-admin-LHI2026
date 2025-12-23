import prisma from '../config/database';
import { AccessCodeService, ProductType } from './accessCodeService';
import { DeepSeekService } from './deepseekService';

export interface AssessmentData {
  accessCode: string;
  productType?: ProductType;
  totalScore: number;
  category: string;
  attachmentStyle?: string;  // Optional for LCI
  dimensions: any[];
  answers: Record<number, number>;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export class AssessmentService {
  static async createAssessment(data: AssessmentData) {
    const productType = data.productType || 'LHI';
    const validation = await AccessCodeService.validateCode(data.accessCode, productType);
    
    if (!validation.valid || !validation.accessCodeId) {
      throw new Error(validation.message || 'Invalid access code');
    }

    // Get AI analysis from DeepSeek
    let aiAnalysis = null;
    try {
      const analysis = await DeepSeekService.analyzeAssessment(
        data.totalScore,
        data.category,
        data.attachmentStyle,
        data.dimensions
      );
      aiAnalysis = JSON.stringify(analysis);
    } catch (error) {
      console.error('Failed to get AI analysis:', error);
    }

    const assessment = await prisma.assessment.create({
      data: {
        accessCodeId: validation.accessCodeId,
        userId: data.userId,
        productType,
        totalScore: data.totalScore,
        category: data.category,
        attachmentStyle: data.attachmentStyle || null,
        dimensions: JSON.stringify(data.dimensions),
        answers: JSON.stringify(data.answers),
        aiAnalysis,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
    });

    await AccessCodeService.markCodeAsUsed(validation.accessCodeId, data.ipAddress);

    // Return with parsed JSON fields
    return {
      ...assessment,
      dimensions: JSON.parse(assessment.dimensions),
      answers: JSON.parse(assessment.answers),
      aiAnalysis: assessment.aiAnalysis ? JSON.parse(assessment.aiAnalysis) : null,
    };
  }

  static async getAssessmentById(id: string) {
    const assessment = await prisma.assessment.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
          },
        },
        accessCode: {
          select: {
            code: true,
            batchId: true,
          },
        },
      },
    });

    if (!assessment) return null;

    return {
      ...assessment,
      dimensions: JSON.parse(assessment.dimensions),
      answers: JSON.parse(assessment.answers),
      aiAnalysis: assessment.aiAnalysis ? JSON.parse(assessment.aiAnalysis) : null,
    };
  }

  static async getAssessmentByAccessCodeId(accessCodeId: string) {
    const assessment = await prisma.assessment.findFirst({
      where: { accessCodeId },
      orderBy: { createdAt: 'desc' },
    });

    if (!assessment) return null;

    return {
      ...assessment,
      dimensions: JSON.parse(assessment.dimensions),
      answers: JSON.parse(assessment.answers),
      aiAnalysis: assessment.aiAnalysis ? (typeof assessment.aiAnalysis === 'string' ? assessment.aiAnalysis : JSON.stringify(assessment.aiAnalysis)) : null,
    };
  }

  static async getUserAssessments(userId: string) {
    const assessments = await prisma.assessment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        accessCode: {
          select: { code: true },
        },
      },
    });

    return assessments.map(a => ({
      ...a,
      dimensions: JSON.parse(a.dimensions),
      answers: JSON.parse(a.answers),
    }));
  }

  static async getStatistics(productType?: string) {
    const whereClause = productType ? { productType } : {};

    const total = await prisma.assessment.count({ where: whereClause });

    // 获取所有评估数据用于计算
    const allAssessments = await prisma.assessment.findMany({ where: whereClause });

    // LHI Category distribution - 只统计LHI的类别
    const lhiAssessments = allAssessments.filter(a => a.productType === 'LHI');
    const lhiCategoryCount: Record<string, number> = {};
    lhiAssessments.forEach(a => {
      if (a.category) {
        lhiCategoryCount[a.category] = (lhiCategoryCount[a.category] || 0) + 1;
      }
    });
    const lhiCategoryDistribution = Object.entries(lhiCategoryCount).map(([category, count]) => ({
      category,
      count
    }));

    // LCI Category distribution - 只统计LCI的类别
    const lciAssessments = allAssessments.filter(a => a.productType === 'LCI');
    const lciCategoryCount: Record<string, number> = {};
    lciAssessments.forEach(a => {
      if (a.category) {
        lciCategoryCount[a.category] = (lciCategoryCount[a.category] || 0) + 1;
      }
    });
    const lciCategoryDistribution = Object.entries(lciCategoryCount).map(([category, count]) => ({
      category,
      count
    }));

    // Attachment style distribution - 只统计ASA的依恋风格
    const asaAssessments = allAssessments.filter(a => a.productType === 'ASA');
    const attachmentCount: Record<string, number> = {};
    asaAssessments.forEach(a => {
      if (a.attachmentStyle) {
        attachmentCount[a.attachmentStyle] = (attachmentCount[a.attachmentStyle] || 0) + 1;
      }
    });
    const attachmentDistribution = Object.entries(attachmentCount).map(([style, count]) => ({
      style,
      count
    }));

    const avgScore = await prisma.assessment.aggregate({
      where: whereClause,
      _avg: { totalScore: true },
      _min: { totalScore: true },
      _max: { totalScore: true },
    });

    const recentAssessments = await prisma.assessment.findMany({
      where: whereClause,
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        totalScore: true,
        category: true,
        attachmentStyle: true,
        productType: true,
        aiAnalysis: true,
        createdAt: true,
      },
    });

    // Calculate daily stats for the last 30 days (compatible with SQLite)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentForTrend = await prisma.assessment.findMany({
      where: {
        ...whereClause,
        createdAt: {
          gte: thirtyDaysAgo
        }
      },
      select: {
        createdAt: true,
        productType: true
      }
    });

    // Group by date
    const dailyStatsMap: Record<string, { date: string; count: number; lhi: number; lci: number; asa: number }> = {};

    // Initialize last 30 days with 0 counts
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      dailyStatsMap[dateStr] = { date: dateStr, count: 0, lhi: 0, lci: 0, asa: 0 };
    }

    // Count assessments per day
    recentForTrend.forEach(a => {
      const dateStr = a.createdAt.toISOString().split('T')[0];
      if (dailyStatsMap[dateStr]) {
        dailyStatsMap[dateStr].count++;
        if (a.productType === 'LHI') dailyStatsMap[dateStr].lhi++;
        else if (a.productType === 'LCI') dailyStatsMap[dateStr].lci++;
        else if (a.productType === 'ASA') dailyStatsMap[dateStr].asa++;
      }
    });

    const dailyStats = Object.values(dailyStatsMap).sort((a, b) => a.date.localeCompare(b.date));

    return {
      total,
      avgScore: Math.round(avgScore._avg.totalScore || 0),
      minScore: avgScore._min.totalScore || 0,
      maxScore: avgScore._max.totalScore || 0,
      lhiCategoryDistribution,
      lciCategoryDistribution,
      attachmentDistribution,
      recentAssessments,
      dailyStats,
    };
  }

  static async listAssessments(page: number = 1, limit: number = 20, productType?: string) {
    const skip = (page - 1) * limit;
    const whereClause = productType ? { productType } : {};

    const [assessments, total] = await Promise.all([
      prisma.assessment.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              email: true,
              username: true,
            },
          },
          accessCode: {
            select: { code: true },
          },
        },
      }),
      prisma.assessment.count({ where: whereClause }),
    ]);

    return {
      assessments: assessments.map(a => ({
        ...a,
        dimensions: JSON.parse(a.dimensions),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
