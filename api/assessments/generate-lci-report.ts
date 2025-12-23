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

    const prompt = `你是一位资深的亲密关系心理咨询师，请基于以下LCI爱情浓度测试数据，撰写一份专业深度的分析报告。

【测试数据】
- LCI爱情浓度指数: ${percentage}%
- 关系等级: ${level}
- 五维得分详情:
  · 沟通维度: ${dimensionScores.communication}/40 (${commStatus})
  · 行动维度: ${dimensionScores.action}/40 (${actStatus})
  · 情感维度: ${dimensionScores.emotion}/40 (${emoStatus})
  · 尊重维度: ${dimensionScores.respect}/40 (${respStatus})
  · 成长维度: ${dimensionScores.growth}/40 (${growStatus})
- 最强维度: ${highest.name}(${highest.score}分)
- 最弱维度: ${lowest.name}(${lowest.score}分)

【报告要求】
请生成1200-1500字的深度报告，使用Markdown格式，包含以下部分：

**整体评估**
深入分析${percentage}%的爱情浓度意味着什么，这段关系目前处于什么状态，双方的情感投入程度如何。结合"${level}"这个等级，给出专业的关系诊断。(150字)

**五维分析**
对每个维度进行深度解读：
- **沟通(${dimensionScores.communication}/40)**: 分析沟通模式、表达方式、倾听质量
- **行动(${dimensionScores.action}/40)**: 分析付出程度、陪伴质量、承诺兑现
- **情感(${dimensionScores.emotion}/40)**: 分析情感连接深度、安全感、亲密程度
- **尊重(${dimensionScores.respect}/40)**: 分析边界感、价值认同、人格尊重
- **成长(${dimensionScores.growth}/40)**: 分析共同愿景、相互促进、未来期待
每个维度80-100字，要有具体的行为表现描述和心理洞察。

**关系闪光点**
基于数据找出2-3个关系中的积极因素，具体说明为什么这些是优势，如何利用这些优势。

**需要关注**
指出1-2个核心问题，分析问题背后的心理动因，为什么这些问题如果不解决会影响关系。

**改善建议**
给出3条具体可操作的建议，每条建议要包含：具体做什么、怎么做、预期效果。建议要针对性强，不要泛泛而谈。

**寄语**
一句温暖有力的话，给予希望和方向。

【风格要求】
- 专业但不冰冷，温暖但不敷衍
- 洞察深刻，直击问题本质
- 建议具体可行，不说空话
- 禁止使用"#"符号作为标题`;

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
        temperature: 0.75,
        max_tokens: 2500,
        top_p: 0.95,
        stream: false
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
