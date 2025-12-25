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
  // CORS 设置 - 必须在最前面
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 处理 OPTIONS 预检请求
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 只允许 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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

    const prompt = `基于以下依恋测评数据，生成简明深度报告（500-700字）。

数据: ${primaryType}型，安全${rates.secure}%/焦虑${rates.anxious}%/回避${rates.avoidant}%/恐惧${rates.fearful}%

要求：用**加粗**做标题，段落间空行，禁用#符号。

框架：
1. **模式解析**：主导类型成因（2段）
2. **行为特征**：防御机制（1段）
3. **成长建议**：2-3条具体练习
4. **结语**（1句话）

直接输出正文。`;

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
            content: '你是一位专业的依恋理论心理专家，擅长分析依恋模式并提供深度心理洞察。请简洁有力地回答。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1200,
        top_p: 0.9
      }),
      signal: AbortSignal.timeout(55000) // 55秒超时
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
