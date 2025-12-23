import type { VercelRequest, VercelResponse } from '@vercel/node';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
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

    const { count = 1, productType = 'LHI' } = req.body;
    const batchId = `batch_${Date.now()}`;
    const codes = [];

    for (let i = 0; i < count; i++) {
      let code = generateCode();

      // Ensure uniqueness
      let existing = await prisma.accessCode.findUnique({ where: { code } });
      while (existing) {
        code = generateCode();
        existing = await prisma.accessCode.findUnique({ where: { code } });
      }

      const accessCode = await prisma.accessCode.create({
        data: {
          code,
          productType,
          batchId,
          isUsed: false
        }
      });

      codes.push(accessCode);
    }

    return res.status(200).json({ codes });
  } catch (error: any) {
    console.error('Generate access codes error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    await prisma.$disconnect();
  }
}
