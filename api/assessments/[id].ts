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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Assessment ID is required' });
  }

  const db = getPrisma();

  // POST or PUT: Update AI analysis
  if (req.method === 'POST' || req.method === 'PUT') {
    try {
      const { aiAnalysis, aiAnalysisPart, part, appendMode } = req.body;

      // Verify assessment exists
      const assessment = await db.assessment.findUnique({
        where: { id }
      });

      if (!assessment) {
        return res.status(404).json({ error: 'Assessment not found' });
      }

      // 处理分部分保存的情况
      if (aiAnalysisPart !== undefined) {
        let newAnalysis = aiAnalysisPart;

        // 如果是追加模式且已有内容
        if (appendMode && assessment.aiAnalysis) {
          newAnalysis = assessment.aiAnalysis + '\n\n' + aiAnalysisPart;
        }

        // 只有第4部分完成时才标记为 completed
        const newStatus = part === 4 ? 'completed' : 'generating';

        await db.assessment.update({
          where: { id },
          data: {
            aiAnalysis: newAnalysis,
            aiStatus: newStatus
          }
        });

        console.log(`[Update AI] Assessment ${id} part ${part} saved, total length: ${newAnalysis.length}, status: ${newStatus}`);

        return res.status(200).json({
          success: true,
          message: `Part ${part} saved successfully`
        });
      }

      // 处理完整保存的情况
      if (aiAnalysis) {
        await db.assessment.update({
          where: { id },
          data: { aiAnalysis: aiAnalysis }
        });

        console.log(`[Update AI] Assessment ${id} AI analysis updated, length: ${aiAnalysis.length}`);

        return res.status(200).json({
          success: true,
          message: 'AI analysis saved successfully'
        });
      }

      return res.status(400).json({ error: 'AI analysis content is required' });
    } catch (error: any) {
      console.error('Update AI analysis error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // GET: Retrieve assessment
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
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
      aiStatus: (assessment as any).aiStatus || 'completed',
      createdAt: assessment.createdAt
    });
  } catch (error: any) {
    console.error('Get assessment error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
