import type { VercelRequest, VercelResponse } from '@vercel/node';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify JWT token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.substring(7);
    const jwtSecret = process.env.JWT_SECRET || 'default-secret-key';

    try {
      jwt.verify(token, jwtSecret);
    } catch (error) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Get productType filter from query
    const { productType } = req.query;
    const whereClause = productType ? { productType: productType as string } : {};

    // Get statistics with optional productType filter
    const total = await prisma.assessment.count({ where: whereClause });

    const assessments = await prisma.assessment.findMany({ where: whereClause });

    // Calculate scores
    const scores = assessments.map(a => a.totalScore);
    const avgScore = scores.length > 0
      ? Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length)
      : 0;
    const minScore = scores.length > 0 ? Math.min(...scores) : 0;
    const maxScore = scores.length > 0 ? Math.max(...scores) : 0;

    // Category distribution - 只统计LHI/LCI的类别（ASA没有category）
    const lhiLciAssessments = assessments.filter(a => a.productType === 'LHI' || a.productType === 'LCI');
    const categoryCount: Record<string, number> = {};
    lhiLciAssessments.forEach(a => {
      if (a.category) {
        categoryCount[a.category] = (categoryCount[a.category] || 0) + 1;
      }
    });
    const categoryDistribution = Object.entries(categoryCount).map(([category, count]) => ({
      category,
      count
    }));

    // Attachment style distribution - 只统计ASA的依恋风格
    const asaAssessments = assessments.filter(a => a.productType === 'ASA');
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

    // Get recent assessments with optional productType filter (including aiAnalysis)
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
      }
    });

    // Calculate daily stats for the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentAssessmentsForTrend = await prisma.assessment.findMany({
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
    recentAssessmentsForTrend.forEach(a => {
      const dateStr = a.createdAt.toISOString().split('T')[0];
      if (dailyStatsMap[dateStr]) {
        dailyStatsMap[dateStr].count++;
        if (a.productType === 'LHI') dailyStatsMap[dateStr].lhi++;
        else if (a.productType === 'LCI') dailyStatsMap[dateStr].lci++;
        else if (a.productType === 'ASA') dailyStatsMap[dateStr].asa++;
      }
    });

    const dailyStats = Object.values(dailyStatsMap).sort((a, b) => a.date.localeCompare(b.date));

    return res.status(200).json({
      total,
      avgScore,
      minScore,
      maxScore,
      categoryDistribution,
      attachmentDistribution,
      recentAssessments,
      dailyStats
    });
  } catch (error: any) {
    console.error('Get stats error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    await prisma.$disconnect();
  }
}
