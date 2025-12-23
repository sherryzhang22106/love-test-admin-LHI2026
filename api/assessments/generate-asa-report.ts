import type { VercelRequest, VercelResponse } from '@vercel/node';

// DeepSeek AI Configuration
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_MODEL = 'deepseek-chat';

// 速率限制
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 3; // 每小时最多3次
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1小时

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

interface ASAReportRequest {
  scores: {
    secure: number;
    anxious: number;
    avoidant: number;
    fearful: number;
  };
  primaryType: string;
  answerSummary: string;
  accessCodeId?: string;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // 只允许 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // CORS 设置
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 获取客户端 IP
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
             req.socket.remoteAddress ||
             'unknown';

  // 速率限制检查
  if (!checkRateLimit(ip)) {
    return res.status(429).json({
      error: '生成报告次数过多，请1小时后再试',
      retryAfter: 3600
    });
  }

  // 验证 API 密钥
  if (!DEEPSEEK_API_KEY) {
    console.error('Missing DEEPSEEK_API_KEY');
    return res.status(500).json({
      error: '服务配置错误，请联系管理员'
    });
  }

  try {
    const { scores, primaryType, answerSummary, accessCodeId } = req.body as ASAReportRequest;

    // 验证输入
    if (!scores || !primaryType) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    const MAX_PER_TYPE = 160;
    const rates = {
      secure: ((scores.secure / MAX_PER_TYPE) * 100).toFixed(1),
      anxious: ((scores.anxious / MAX_PER_TYPE) * 100).toFixed(1),
      avoidant: ((scores.avoidant / MAX_PER_TYPE) * 100).toFixed(1),
      fearful: ((scores.fearful / MAX_PER_TYPE) * 100).toFixed(1),
    };

    const prompt = `你是一位享誉国际的依恋理论临床专家。请基于以下数据生成一份深度、长篇（1500-2000字）的测评报告。

【核心数据】
- 最终判定的依恋类型: ${primaryType}
- 详细得分比率: 安全型 ${rates.secure}%, 焦虑型 ${rates.anxious}%, 回避型 ${rates.avoidant}%, 恐惧型 ${rates.fearful}%

【关键心理投射摘要】
${answerSummary || '（用户答题数据）'}

【！！！严格禁令！！！】
1. **禁止出现任何 Markdown 标题符号**: 严禁在输出中包含 "#", "##", "###" 等符号。
2. **禁止自报家门**: 严禁出现"我是心理专家"、"专业咨询师"或任何涉及你身份、报告生成时间、版本号的信息。
3. **确保完整性**: 请提供 1500-2000 字的深度内容，不要在中间截断。

【排版指引】
- 使用**加粗文字**作为各部分的标题（例如：**关系底色：在欲望与逃离的钟摆之间**）。
- 标题下方使用空行。
- 使用 > 引言块来承载核心金句或心理洞察。
- 段落之间保持清晰的空行，确保可读性。
- 使用项目符号（- ）列举具体的练习建议。

【内容框架】
1. **关系底色：核心模式深度解析**：深度剖析主导类型的心理成因，结合其得分比率（如焦虑与回避的重叠）进行解析。
2. **潜意识回响：防御机制解构**：结合具体题目答案分析其行为闭环。
3. **内在锚点：优势与改变契机**：挖掘用户在关系中的正向潜质。
4. **安全感重塑：分阶段成长方案**：提供 1-6 个月的具体心理练习。
5. **结语：书写新的依恋故事**。

请直接用中文撰写。直接开始正文，确保排版美观、层次分明。`;

    // 调用 DeepSeek API
    const apiResponse = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          {
            role: 'system',
            content: '你是一位专业的依恋理论心理专家，擅长分析依恋模式并提供深度心理洞察。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.75,
        max_tokens: 4000,
        top_p: 0.95
      }),
      signal: AbortSignal.timeout(60000) // 60秒超时
    });

    if (!apiResponse.ok) {
      const errorData = await apiResponse.json().catch(() => ({}));
      console.error('[DeepSeek API Error]', apiResponse.status, errorData);

      if (apiResponse.status === 429) {
        return res.status(429).json({
          error: 'API 调用频率过高，请稍后重试'
        });
      }

      return res.status(500).json({
        error: '生成报告时遇到问题，请稍后重试'
      });
    }

    const data = await apiResponse.json();
    let text = data.choices?.[0]?.message?.content || "";

    if (!text) {
      return res.status(500).json({
        error: '生成的报告为空，请重试'
      });
    }

    // 后置处理：清除可能的 Markdown 标题符号
    text = text.replace(/#{1,6}\s?/g, "");

    // 记录日志
    console.log(`[ASA Report Generated] IP: ${ip}, Type: ${primaryType}, Length: ${text.length}, AccessCodeId: ${accessCodeId || 'N/A'}`);

    return res.status(200).json({
      success: true,
      report: text,
      generated: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('[Generate ASA Report Error]', error);

    // 根据错误类型返回不同的响应
    if (error.name === 'AbortError' || error.message?.includes('timeout')) {
      return res.status(504).json({
        error: '报告生成超时，请重试'
      });
    }

    return res.status(500).json({
      error: '生成报告时遇到问题，请稍后重试',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
