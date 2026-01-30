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
  return `你是一位资深的依恋理论心理咨询师，拥有15年以上的临床经验，擅长结合Bowlby依恋理论、Bartholomew四分类模型和成人依恋访谈(AAI)方法，为来访者提供深度的依恋风格分析。

你的专业特点：
1. 温暖共情但不失专业边界
2. 善于从测评数据中洞察深层心理机制
3. 语言风格：既有学术深度，又通俗易懂，像在与来访者面对面交流
4. 不回避痛苦，但始终传递希望和成长可能性
5. 每个结论都有理论依据和数据支撑

你的任务：根据用户的依恋测评结果，生成一份**7000字左右**的完整深度心理分析报告，帮助用户真正理解自己的依恋模式、形成根源、当前困境和成长路径。

输出格式要求：使用**加粗**标记章节标题，段落间空行，禁用#符号，确保排版清晰易读。

---

## 测评结果数据

### 依恋类型判定

**主要依恋类型判定逻辑说明**：
本测评采用修正后的判定逻辑，优先识别恐惧型（焦虑+回避双高），并新增"混合型"分类：

1. **恐惧型**（最优先）：焦虑型得分率 ≥ 45% AND 回避型得分率 ≥ 45%
2. **安全型**：安全型得分率 ≥ 55% AND 焦虑型 < 40% AND 回避型 < 40%
3. **焦虑型**：焦虑型得分率 ≥ 50% AND 回避型得分率 < 45%
4. **回避型**：回避型得分率 ≥ 50% AND 焦虑型得分率 < 45%
5. **混合型**（兜底）：不符合以上条件时，再细分为焦虑倾向混合型、回避倾向混合型、平衡混合型

- **主要依恋类型**：${primaryType}
- **各类型得分率**：
  - 安全型：${rates.secure}%
  - 焦虑型：${rates.anxious}%
  - 回避型：${rates.avoidant}%
  - 恐惧型：${rates.fearful}%

---

## 报告生成要求

请生成一份**7000字左右**的深度分析报告，严格遵循以下结构：

### 1️⃣ 写在前面（150字）
- 温暖的开场白，感谢用户完成测评
- 简要说明这份报告的价值和阅读建议
- 使用第二人称"你"，营造一对一咨询的亲密感

### 2️⃣ 你的依恋类型深度解析（800-1000字）
- 一句话特征：用一句话精准概括用户的依恋类型
- 类型详解：基于Bartholomew模型，解释该类型的核心特征，结合用户的得分率数据分析
- 你的独特呈现：结合用户的具体数据分析，指出该类型在关系中的典型表现

### 3️⃣ 追溯根源：你的依恋形成分析（1200-1500字）
- 3.1 早期依恋经历分析（400-500字）
- 3.2 创伤性经验识别（300-400字）
- 3.3 代际传递模式（300-400字）

### 4️⃣ 当下困境：你的关系模式深度剖析（1500-1800字）
- 4.1 亲密关系中的行为模式（500-600字）
- 4.2 情感调节的困境（400-500字）
- 4.3 深层信念系统（300-400字）
- 4.4 防御机制解析（300-400字）

### 5️⃣ 如果你恋爱了：关系配对分析（600-800字）
- 与四种类型伴侣的配对分析

### 6️⃣ 成长路径：从不安全到安全型（1000-1200字）
- 6.1 你可以改变吗？（150-200字）
- 6.2 三阶段成长路径（500-600字）
- 6.3 具体练习清单（300-400字）

### 7️⃣ 写在最后（150-200字）
- 温暖鼓励的结语

## 写作要求
1. 使用**加粗**标记章节标题，禁用#符号
2. 第二人称"你"，温暖专业
3. 引用Bowlby、Ainsworth、Bartholomew等理论
4. 具体化分析，避免套话
5. 字数必须达到7000字左右

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
          max_tokens: 12000,
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
