import type { VercelRequest, VercelResponse } from '@vercel/node';
import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient | null = null;

function getPrisma() {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}

// 万能码列表 - 可无限次使用
const MASTER_CODES = ['LHI159951', 'LCI2025', 'ASA2025', 'ALL2025'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle OPTIONS preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('=== SUBMIT ASA ASSESSMENT START ===');
    const {
      accessCode,
      scores,
      answers,
      primaryType,
      dimensions
    } = req.body;

    console.log('Request body:', { accessCode, primaryType, hasScores: !!scores, hasAnswers: !!answers });

    if (!accessCode) {
      return res.status(400).json({ error: 'Access code is required' });
    }

    if (!scores || !primaryType) {
      return res.status(400).json({ error: 'Scores and primaryType are required' });
    }

    const db = getPrisma();

    // Find and validate access code
    const codeRecord = await db.accessCode.findUnique({
      where: { code: accessCode }
    });

    if (!codeRecord) {
      return res.status(404).json({ error: 'Access code not found' });
    }

    // 万能码跳过已使用检查
    const isMasterCode = MASTER_CODES.includes(accessCode.toUpperCase());

    if (!isMasterCode && codeRecord.isUsed) {
      return res.status(400).json({ error: 'Access code already used' });
    }

    // Get IP and User Agent
    const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
                     (req.headers['x-real-ip'] as string) ||
                     'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    // 计算总分（用于兼容现有数据结构）
    const totalScore = scores.secure + scores.anxious + scores.avoidant + scores.fearful;

    console.log('Creating ASA assessment record...');
    // Create assessment record (AI报告会通过 generate-asa-report API 单独生成)
    const assessment = await db.assessment.create({
      data: {
        accessCodeId: codeRecord.id,
        productType: 'ASA',
        totalScore,
        category: primaryType,
        attachmentStyle: primaryType,
        dimensions: JSON.stringify(dimensions),
        answers: JSON.stringify(answers),
        aiAnalysis: null,
        ipAddress,
        userAgent
      }
    });
    console.log('ASA Assessment created with ID:', assessment.id);

    // 万能码不标记为已使用
    if (!isMasterCode) {
      console.log('Updating access code status...');
      await db.accessCode.update({
        where: { id: codeRecord.id },
        data: {
          isUsed: true,
          usedAt: new Date(),
          usedByIp: ipAddress
        }
      });
      console.log('Access code marked as used:', codeRecord.code);
    } else {
      console.log('Master code used, not marking as used:', codeRecord.code);
    }

    console.log('=== SUBMIT ASA ASSESSMENT SUCCESS ===');

    return res.status(200).json({
      id: assessment.id,
      productType: 'ASA',
      primaryType,
      scores
    });
  } catch (error: any) {
    console.error('=== SUBMIT ASA ASSESSMENT ERROR ===');
    console.error('Error:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
}
