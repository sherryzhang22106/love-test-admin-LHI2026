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

    const prompt = `
你是一位顶级情感关系专家（擅长心理学、社会学与依恋理论），正在为用户生成一份**深度、详实、高价值**的 LCI (Love Concentration Index) 爱情浓度测试付费版报告。

**重要要求：**
1. **字数要求**：整篇报告总字数请控制在 **1200字以上**。用户是付费查看的，请不要敷衍，内容要丰满、具体、有深度。
2. **术语准确**：必须使用 "LCI" (Love Concentration Index) 作为核心术语，**严禁写成 "LDI" 或其他拼写**。请仔细检查拼写。
3. **结构严格**：必须使用Markdown格式，标题使用 "## "。
4. **禁止内容**：**严禁**在报告中添加"报告编号"、"报告生成时间"、"测试日期"、"用户ID"等任何元数据信息。直接从正文内容开始。

## 用户数据
- 维度得分（满分40）：
沟通: ${dimensionScores.communication}
行动: ${dimensionScores.action}
情感: ${dimensionScores.emotion}
尊重: ${dimensionScores.respect}
成长: ${dimensionScores.growth}
- LCI指数: ${percentage}%
- 等级: ${level}

## 报告结构与内容要求

## 📊 整体评估
[请撰写约200字。用温暖、专业且具有共情力的语言描述他们当前的关系状态。结合总分和等级，给出一个整体的定性分析。不要只说空话，要结合分数高低体现差异性。]

## 📈 LCI 五维雷达深度分析
[这是报告的核心，请详细撰写。**每个维度至少撰写 150 字**。]
[针对5个维度（沟通、行动、情感、尊重、成长）逐一进行深度剖析。解释得分意味着什么，体现了哪些具体的相处模式（参考题目内容进行推断）。对于高分维度给予肯定，对于低分维度给予温和的警示。]
[使用 ### 维度名 的格式来区分每个维度]

## 💪 你们关系的闪光点
- **闪光点1**：[详细描述，约50-80字]
- **闪光点2**：[详细描述，约50-80字]
- **闪光点3**：[详细描述，约50-80字]

## 🔍 需要呵护的地方
- **关注点1**：[温和指出不足，并分析可能的原因，约50-80字]
- **关注点2**：[温和指出不足，并分析可能的原因，约50-80字]

## 🎁 专属改善建议
- **建议1**：[具体、可执行的操作指南，避免大道理，约80-100字]
- **建议2**：[具体、可执行的操作指南，避免大道理，约80-100字]
- **建议3**：[具体、可执行的操作指南，避免大道理，约80-100字]

## 🌈 心理学彩蛋
[引用一个专业的心理学效应或理论（如皮格马利翁效应、吊桥效应、刺猬效应等）来解释他们的关系模式，增加报告的知识含量。]

## 💝 写在最后
[一段温暖、充满希望的结语，鼓励他们经营关系。不要添加任何署名、日期或编号。]
    `;

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
        max_tokens: 3000,
        top_p: 0.95,
        stream: false
      }),
      signal: AbortSignal.timeout(55000) // 55秒超时，给Vercel留余量
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
