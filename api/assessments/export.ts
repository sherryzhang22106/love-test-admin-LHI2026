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

    // Get query parameters
    const { productType, startDate, endDate, format } = req.query;

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
      // Parse dimensions if available
      dimensions: a.dimensions || ''
    }));

    // Return as JSON (frontend will convert to CSV)
    return res.status(200).json({
      success: true,
      count: exportData.length,
      data: exportData
    });

  } catch (error: any) {
    console.error('Export error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    await prisma.$disconnect();
  }
}
