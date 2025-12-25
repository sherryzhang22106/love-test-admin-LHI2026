import type { VercelRequest, VercelResponse } from '@vercel/node';
import { PrismaClient } from '@prisma/client';
import { generateAIAnalysis } from '../../lib/services/deepseek.js';

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
    console.log('=== SUBMIT ASSESSMENT START ===');
    const {
      accessCode,
      productType = 'LHI',
      totalScore,
      category,
      attachmentStyle,
      dimensions,
      answers
    } = req.body;

    console.log('Request body:', { accessCode, productType, totalScore, category, attachmentStyle });

    if (!accessCode) {
      return res.status(400).json({ error: 'Access code is required' });
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

    // Generate AI analysis first (async call to DeepSeek) - only for LHI
    console.log('Generating AI analysis...');
    let aiAnalysisObject;
    if (productType === 'LHI') {
      try {
        aiAnalysisObject = await generateAIAnalysis(totalScore, category, attachmentStyle, dimensions);
        console.log('AI analysis generated successfully');
      } catch (aiError: any) {
        console.error('AI analysis generation failed:', aiError.message);
        // Use fallback but continue with data saving
        aiAnalysisObject = {
          resultInterpretation: '分析生成失败，请稍后重试',
          strengths: '',
          areasToWatch: '',
          personalizedAdvice: '',
          professionalAdvice: ''
        };
      }
    } else {
      // For LCI, AI analysis is generated separately via DeepSeek in frontend
      aiAnalysisObject = null;
    }

    // Store as JSON string in database
    const aiAnalysis = aiAnalysisObject ? JSON.stringify(aiAnalysisObject) : null;

    console.log('Creating assessment record...');
    // Create assessment with AI analysis
    const assessment = await db.assessment.create({
      data: {
        accessCodeId: codeRecord.id,
        productType,
        totalScore,
        category,
        attachmentStyle: attachmentStyle || null,
        dimensions: JSON.stringify(dimensions),
        answers: JSON.stringify(answers),
        aiAnalysis,
        ipAddress,
        userAgent
      }
    });
    console.log('Assessment created with ID:', assessment.id);

    // 万能码不标记为已使用
    if (!isMasterCode) {
      console.log('Updating access code status...');
      // Mark access code as used
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

    console.log('=== SUBMIT ASSESSMENT SUCCESS ===');
    console.log('Assessment ID:', assessment.id);

    return res.status(200).json({
      id: assessment.id,
      productType,
      totalScore,
      category,
      attachmentStyle,
      dimensions,
      aiAnalysis: aiAnalysisObject
    });
  } catch (error: any) {
    console.error('=== SUBMIT ASSESSMENT ERROR ===');
    console.error('Error:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
}
