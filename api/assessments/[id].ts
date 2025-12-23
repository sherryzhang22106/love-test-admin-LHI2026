import type { VercelRequest, VercelResponse } from '@vercel/node';
import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient | null = null;

function getPrisma() {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Assessment ID is required' });
    }

    const db = getPrisma();

    const assessment = await db.assessment.findUnique({
      where: { id }
    });

    if (!assessment) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    // Parse JSON fields with error handling
    let dimensions = [];
    let answers = {};

    try {
      if (assessment.dimensions) {
        dimensions = JSON.parse(assessment.dimensions);
      }
    } catch (e) {
      console.error('Failed to parse dimensions:', e);
    }

    try {
      if (assessment.answers) {
        answers = JSON.parse(assessment.answers);
      }
    } catch (e) {
      console.error('Failed to parse answers:', e);
    }

    // Parse AI analysis - can be JSON object or plain string (for LCI)
    let parsedAnalysis = null;
    if (assessment.aiAnalysis) {
      try {
        // Try to parse as JSON first (LHI format)
        const parsed = JSON.parse(assessment.aiAnalysis);
        // Check if it's a meaningful object (not empty or just {})
        if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
          parsedAnalysis = parsed;
        } else {
          // If parsed to empty object, treat as raw string
          parsedAnalysis = assessment.aiAnalysis;
        }
      } catch {
        // Not JSON, return as raw string (LCI markdown format)
        parsedAnalysis = assessment.aiAnalysis;
      }
    }

    return res.status(200).json({
      id: assessment.id,
      totalScore: assessment.totalScore,
      category: assessment.category,
      attachmentStyle: assessment.attachmentStyle,
      dimensions,
      answers,
      aiAnalysis: parsedAnalysis,
      createdAt: assessment.createdAt
    });
  } catch (error: any) {
    console.error('Get assessment error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
