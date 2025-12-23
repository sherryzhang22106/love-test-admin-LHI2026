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
    const { page = '1', limit = '50', filter = 'all', productType } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    let where: any = {};
    if (filter === 'used') {
      where.isUsed = true;
    } else if (filter === 'available') {
      where.isUsed = false;
    }

    if (productType) {
      where.productType = productType as string;
    }

    const codes = await db.accessCode.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { createdAt: 'desc' }
    });

    const total = await db.accessCode.count({ where });

    return res.status(200).json({
      codes,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum)
    });
  } catch (error: any) {
    console.error('List codes error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
