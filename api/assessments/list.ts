import type { VercelRequest, VercelResponse } from '@vercel/node';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

let prisma: PrismaClient | null = null;

function getPrisma() {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
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

    const db = getPrisma();
    const { page = '1', limit = '20', productType } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build where clause with optional productType filter
    const whereClause = productType ? { productType: productType as string } : {};

    const assessments = await db.assessment.findMany({
      where: whereClause,
      skip,
      take: limitNum,
      orderBy: { createdAt: 'desc' },
      include: {
        accessCode: {
          select: { code: true }
        }
      }
    });

    const total = await db.assessment.count({ where: whereClause });

    return res.status(200).json({
      assessments,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum)
    });
  } catch (error: any) {
    console.error('List assessments error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
