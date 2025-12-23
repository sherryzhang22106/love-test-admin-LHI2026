import type { VercelRequest, VercelResponse } from '@vercel/node';

// DeepSeek AI Configuration
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_MODEL = 'deepseek-chat';

// 速率限制
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 5; // 每小时最多5次
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

interface LCIReportRequest {
  dimensionScores: {
    communication: number;
    action: number;
    emotion: number;
    respect: number;
    growth: number;
  };
  percentage: number;
  level: string;
  accessCodeId?: string;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // 处理 OPTIONS 预检请求
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  // 只允许 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // CORS 设置
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
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
    const { dimensionScores, percentage, level, accessCodeId } = req.body as LCIReportRequest;

    // 验证输入
    if (!dimensionScores || percentage === undefined || !level) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    // 计算各维度状态
    const getDimensionStatus = (score: number) => {
      if (score >= 32) return '优秀';
      if (score >= 24) return '良好';
      if (score >= 16) return '待提升';
      return '需关注';
    };

    const commStatus = getDimensionStatus(dimensionScores.communication);
    const actStatus = getDimensionStatus(dimensionScores.action);
    const emoStatus = getDimensionStatus(dimensionScores.emotion);
    const respStatus = getDimensionStatus(dimensionScores.respect);
    const growStatus = getDimensionStatus(dimensionScores.growth);

    // 找出最高和最低维度
    const dims = [
      { name: '沟通', score: dimensionScores.communication },
      { name: '行动', score: dimensionScores.action },
      { name: '情感', score: dimensionScores.emotion },
      { name: '尊重', score: dimensionScores.respect },
      { name: '成长', score: dimensionScores.growth }
    ];
    const sorted = [...dims].sort((a, b) => b.score - a.score);
    const highest = sorted[0];
    const lowest = sorted[sorted.length - 1];

    const prompt = `你是亲密关系心理咨询师，基于LCI爱情浓度测试数据撰写深度分析报告。

【数据】
- LCI指数: ${percentage}% | 等级: ${level}
- 沟通: ${dimensionScores.communication}/40(${commStatus}) | 行动: ${dimensionScores.action}/40(${actStatus})
- 情感: ${dimensionScores.emotion}/40(${emoStatus}) | 尊重: ${dimensionScores.respect}/40(${respStatus}) | 成长: ${dimensionScores.growth}/40(${growStatus})
- 最强: ${highest.name}(${highest.score}分) | 最弱: ${lowest.name}(${lowest.score}分)

【要求】生成1000字左右的Markdown报告，禁用#标题，用**加粗**做标题：

**整体评估**
${percentage}%爱情浓度的关系诊断，"${level}"等级意味着什么。(100字)

**五维深度解析**
每维度60字，分析具体行为表现和心理含义：
- 沟通：表达与倾听质量
- 行动：付出与陪伴程度
- 情感：连接深度与安全感
- 尊重：边界与价值认同
- 成长：共同愿景与促进

**关系闪光点**
2个优势及如何利用(100字)

**核心问题**
1-2个问题及心理动因(100字)

**行动建议**
3条具体可操作建议，每条含做什么+怎么做(150字)

**寄语**
一句温暖有力的话

风格：专业深刻，温暖不敷衍，针对性强`;

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
            content: '你是一位专业的情感关系专家，擅长分析爱情关系并提供深度心理洞察。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000,
        top_p: 0.9,
        stream: false
      }),
      signal: AbortSignal.timeout(50000) // 50秒超时
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
    const text = data.choices?.[0]?.message?.content || "";

    if (!text) {
      return res.status(500).json({
        error: '生成的报告为空，请重试'
      });
    }

    // 记录日志
    console.log(`[LCI Report Generated] IP: ${ip}, Level: ${level}, Percentage: ${percentage}%, Length: ${text.length}, AccessCodeId: ${accessCodeId || 'N/A'}`);

    return res.status(200).json({
      success: true,
      report: text,
      generated: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('[Generate LCI Report Error]', error);

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
