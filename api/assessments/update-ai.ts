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
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { assessmentId, aiAnalysis } = req.body;

    if (!assessmentId) {
      return res.status(400).json({ error: 'Assessment ID is required' });
    }

    if (!aiAnalysis) {
      return res.status(400).json({ error: 'AI analysis is required' });
    }

    const db = getPrisma();

    // Check if assessment exists
    const assessment = await db.assessment.findUnique({
      where: { id: assessmentId }
    });

    if (!assessment) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    // Update AI analysis
    await db.assessment.update({
      where: { id: assessmentId },
      data: {
        aiAnalysis: typeof aiAnalysis === 'string' ? aiAnalysis : JSON.stringify(aiAnalysis)
      }
    });

    console.log('AI analysis updated for assessment:', assessmentId);

    return res.status(200).json({
      success: true,
      message: 'AI analysis updated successfully'
    });
  } catch (error: any) {
    console.error('Update AI analysis error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
