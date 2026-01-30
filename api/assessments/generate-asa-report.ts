import type { VercelRequest, VercelResponse } from '@vercel/node';
import { PrismaClient } from '@prisma/client';

// DeepSeek AI Configuration
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_MODEL = 'deepseek-chat';

let prisma: PrismaClient | null = null;

function getPrisma() {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}

// 速率限制
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 3;
const RATE_LIMIT_WINDOW = 60 * 60 * 1000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (record.count >= RATE_LIMIT) {
    return false;
  }

  record.count++;
  return true;
}

function buildPrompt(primaryType: string, rates: { secure: string; anxious: string; avoidant: string; fearful: string }) {
  return `你是一位资深的依恋理论心理咨询师，擅长结合Bowlby依恋理论和Bartholomew四分类模型，为来访者提供专业的依恋风格分析。

## 测评结果
- **主要依恋类型**：${primaryType}
- **得分率**：安全型${rates.secure}%、焦虑型${rates.anxious}%、回避型${rates.avoidant}%、恐惧型${rates.fearful}%

## 任务
请生成一份**3500字左右**的深度分析报告，结构如下：

**1️⃣ 写在前面**（100字）
温暖开场，感谢完成测评，使用"你"称呼。

**2️⃣ 你的依恋类型解析**（600字）
- 一句话特征
- 类型详解：基于Bartholomew模型解释核心特征
- 在关系中的典型表现

**3️⃣ 依恋形成根源**（800字）
- 早期依恋经历分析
- 可能的创伤性经验
- 代际传递模式

**4️⃣ 当下关系模式**（800字）
- 亲密关系中的行为模式
- 情感调节困境
- 深层信念与防御机制

**5️⃣ 关系配对分析**（400字）
与四种类型伴侣的配对建议。

**6️⃣ 成长路径**（600字）
- 改变的可能性
- 具体成长建议和练习

**7️⃣ 写在最后**（100字）
温暖鼓励的结语。

## 要求
1. 使用**加粗**标记标题，禁用#符号
2. 温暖专业，使用"你"
3. 引用依恋理论
4. 具体化分析，避免套话

直接输出正文。`;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS 设置
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
             req.socket.remoteAddress || 'unknown';

  if (!checkRateLimit(ip)) {
    return res.status(429).json({
      error: '生成报告次数过多，请1小时后再试',
      retryAfter: 3600
    });
  }

  if (!DEEPSEEK_API_KEY) {
    console.error('Missing DEEPSEEK_API_KEY');
    return res.status(500).json({ error: '服务配置错误：缺少API密钥' });
  }

  try {
    const { scores, primaryType, assessmentId, stream = true } = req.body;

    if (!scores || !primaryType) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    console.log(`[ASA Report] Starting generation, stream=${stream}, assessmentId=${assessmentId || 'N/A'}, API_KEY exists: ${!!DEEPSEEK_API_KEY}`);

    const MAX_PER_TYPE = 160;
    const rates = {
      secure: ((scores.secure / MAX_PER_TYPE) * 100).toFixed(1),
      anxious: ((scores.anxious / MAX_PER_TYPE) * 100).toFixed(1),
      avoidant: ((scores.avoidant / MAX_PER_TYPE) * 100).toFixed(1),
      fearful: ((scores.fearful / MAX_PER_TYPE) * 100).toFixed(1),
    };

    const prompt = buildPrompt(primaryType, rates);

    // 流式响应
    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const apiResponse = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
          model: DEEPSEEK_MODEL,
          messages: [
            { role: 'system', content: '你是一位资深的依恋理论心理专家，擅长提供深度、温暖、专业的心理分析。' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 8192,
          frequency_penalty: 0.3,
          top_p: 0.9,
          stream: true
        })
      });

      if (!apiResponse.ok) {
        const errorData = await apiResponse.json().catch(() => ({}));
        console.error('[DeepSeek API Error] Status:', apiResponse.status, 'Error:', JSON.stringify(errorData));
        res.write(`data: ${JSON.stringify({ error: `API错误: ${apiResponse.status} - ${errorData.error?.message || '未知错误'}` })}\n\n`);
        res.end();
        return;
      }

      const reader = apiResponse.body?.getReader();
      if (!reader) {
        res.write(`data: ${JSON.stringify({ error: '无法读取响应流' })}\n\n`);
        res.end();
        return;
      }

      const decoder = new TextDecoder();
      let fullContent = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') {
                // 流结束，保存到数据库
                if (assessmentId && fullContent) {
                  const db = getPrisma();
                  try {
                    const cleanContent = fullContent.replace(/#{1,6}\s?/g, "");
                    await db.assessment.update({
                      where: { id: assessmentId },
                      data: { aiAnalysis: cleanContent, aiStatus: 'completed' }
                    });
                    console.log(`[ASA Report] Saved to DB, length: ${cleanContent.length}`);
                  } catch (e) {
                    console.error('[ASA Report] Failed to save:', e);
                  }
                }
                res.write(`data: [DONE]\n\n`);
                continue;
              }

              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content || '';
                if (content) {
                  fullContent += content;
                  res.write(`data: ${JSON.stringify({ content })}\n\n`);
                }
              } catch (e) {
                // 忽略解析错误
              }
            }
          }
        }
      } catch (streamError) {
        console.error('[Stream Error]', streamError);
        res.write(`data: ${JSON.stringify({ error: '流式传输中断' })}\n\n`);
      }

      res.end();
      return;
    }

    // 非流式响应（备用）
    const apiResponse = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          { role: 'system', content: '你是一位资深的依恋理论心理专家，擅长提供深度、温暖、专业的心理分析。' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 12000,
        frequency_penalty: 0.3,
        top_p: 0.9
      }),
      signal: AbortSignal.timeout(90000)
    });

    if (!apiResponse.ok) {
      const errorData = await apiResponse.json().catch(() => ({}));
      console.error('[DeepSeek API Error] Status:', apiResponse.status, 'Error:', JSON.stringify(errorData));
      return res.status(500).json({ error: `API错误: ${apiResponse.status} - ${errorData.error?.message || '未知错误'}` });
    }

    const data = await apiResponse.json();
    let text = data.choices?.[0]?.message?.content || "";
    text = text.replace(/#{1,6}\s?/g, "");

    if (assessmentId && text) {
      const db = getPrisma();
      try {
        await db.assessment.update({
          where: { id: assessmentId },
          data: { aiAnalysis: text, aiStatus: 'completed' }
        });
      } catch (e) {
        console.error('[ASA Report] Failed to save:', e);
      }
    }

    return res.status(200).json({ success: true, report: text });

  } catch (error: any) {
    console.error('[Generate ASA Report Error]', error);
    return res.status(500).json({ error: '生成报告时遇到问题，请稍后重试' });
  }
}
