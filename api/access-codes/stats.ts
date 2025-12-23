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
    const { productType } = req.query;

    const where = productType ? { productType: productType as string } : {};
    const total = await db.accessCode.count({ where });
    const used = await db.accessCode.count({ where: { ...where, isUsed: true } });
    const available = total - used;

    // Get stats per product if no filter
    let byProduct = null;
    if (!productType) {
      const lhiTotal = await db.accessCode.count({ where: { productType: 'LHI' } });
      const lhiUsed = await db.accessCode.count({ where: { productType: 'LHI', isUsed: true } });
      const lciTotal = await db.accessCode.count({ where: { productType: 'LCI' } });
      const lciUsed = await db.accessCode.count({ where: { productType: 'LCI', isUsed: true } });
      const allTotal = await db.accessCode.count({ where: { productType: 'ALL' } });
      const allUsed = await db.accessCode.count({ where: { productType: 'ALL', isUsed: true } });

      byProduct = {
        LHI: { total: lhiTotal, used: lhiUsed, available: lhiTotal - lhiUsed },
        LCI: { total: lciTotal, used: lciUsed, available: lciTotal - lciUsed },
        ALL: { total: allTotal, used: allUsed, available: allTotal - allUsed },
      };
    }

    return res.status(200).json({
      total,
      used,
      available,
      byProduct
    });
  } catch (error: any) {
    console.error('Get code stats error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
