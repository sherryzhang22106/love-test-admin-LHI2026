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

    const prompt = `你是一位资深的依恋理论心理咨询师，拥有15年以上的临床经验，擅长结合Bowlby依恋理论、Bartholomew四分类模型和成人依恋访谈(AAI)方法，为来访者提供深度的依恋风格分析。

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

### 报告结构（必须完整包含）

---

### 1️⃣ 写在前面（150字）

- 温暖的开场白，感谢用户完成测评
- 简要说明这份报告的价值和阅读建议
- 使用第二人称"你"，营造一对一咨询的亲密感

---

### 2️⃣ 你的依恋类型深度解析（800-1000字）

**必须包含**：

- **一句话特征**：用一句话精准概括用户的依恋类型
- **类型详解**：
  - 基于Bartholomew模型，解释该类型的核心特征
  - 结合用户的得分率数据分析
  - 指出用户在四分类模型中的位置（自我模型+他人模型）
- **你的独特呈现**：
  - 不是套模板，而是结合用户的具体数据分析
  - 指出该类型在关系中的典型表现

**特别注意**：
- 如果是"混合型"，必须详细分析焦虑与回避的双重特征如何共存

---

### 3️⃣ 追溯根源：你的依恋形成分析（1200-1500字）

**必须包含**：

**3.1 早期依恋经历分析**（400-500字）
- 基于依恋理论，分析可能的童年依恋画像
- 照顾者的回应模式（稳定性、敏感性、可及性）
- 家庭情感氛围（温暖/冷漠/混乱/过度保护）

**3.2 创伤性经验识别**（300-400字）
- 是否可能有分离创伤、情感忽视、过度干涉等
- 这些经历如何塑造了当前的依恋模式
- 使用心理学术语（如"情感忽视"、"矛盾型养育"）并解释

**3.3 代际传递模式**（300-400字）
- 父母的依恋风格可能是什么
- 你可能继承了哪些模式，又在反抗什么
- 引用依恋理论的"代际传递"研究

---

### 4️⃣ 当下困境：你的关系模式深度剖析（1500-1800字）

**4.1 亲密关系中的行为模式**（500-600字）
- 详细分析：
  - **寻求亲近的方式**：主动/被动/矛盾/回避
  - **冲突处理策略**：攻击/退缩/冷战/沟通
  - **情感表达模式**：直接/压抑/爆发/操纵
  - **信任与嫉妒**：过度信任/疑心重/反复确认

**4.2 情感调节的困境**（400-500字）
- 分析：
  - 情绪识别能力（能否准确说出自己的感受）
  - 情绪强度控制（容易情绪失控吗）
  - 自我安抚能力（独处时如何调节）
  - 情绪传染性（容易被他人情绪影响吗）

**4.3 深层信念系统**（300-400字）
- 揭示3-5个核心信念，如：
  - "我不值得被爱"（低自我价值）
  - "亲密必然带来伤害"（对他人的消极预期）
  - "展示脆弱=失去控制"（情感防御）

**4.4 防御机制解析**（300-400字）
- 识别用户的主要心理防御：
  - 回避型：疏离、理智化、否认需求
  - 焦虑型：过度警觉、情感勒索、取悦
  - 恐惧型：忽冷忽热、投射、分裂
- 这些防御如何"保护"了你，又如何限制了你

---

### 5️⃣ 如果你恋爱了：关系配对分析（600-800字）

**要求**：
- 基于用户的依恋类型，分析与四种类型伴侣的配对动力
- 每种配对写120-150字，包含：
  - 匹配度（用星级或百分比）
  - 可能的冲突模式
  - 相处建议

**四种配对**：
1. **你 × 安全型伴侣**
2. **你 × 焦虑型伴侣**
3. **你 × 回避型伴侣**
4. **你 × 恐惧型伴侣**

---

### 6️⃣ 成长路径：从不安全到安全型（1000-1200字）

**6.1 你可以改变吗？**（150-200字）
- 肯定依恋风格的可塑性
- 引用研究：30-40%的人在一生中会改变依恋类型
- 介绍"赢得性安全依恋"（Earned Secure Attachment）概念

**6.2 三阶段成长路径**（500-600字）

**阶段一：觉察与接纳（0-6个月）**
- 具体任务：写依恋日记、识别防御机制、练习情绪命名
- 推荐工具：正念冥想、情绪轮盘

**阶段二：修复与重建（6-18个月）**
- 具体任务：寻找"矫正性情感体验"、练习脆弱表达、挑战核心信念
- 可选择的疗法：依恋导向治疗、EMDR、图式治疗

**阶段三：整合与巩固（18个月+）**
- 具体任务：在亲密关系中实践新模式、建立稳定的自我安抚系统

**6.3 具体练习清单**（300-400字）
- 给出5-6个可操作的练习，针对用户的依恋类型定制：
  - **焦虑型**：延迟求证练习（忍住不发第二条消息）
  - **回避型**：主动分享练习（每天告诉伴侣一件小事）
  - **恐惧型**：安全感锚定练习（建立稳定的自我关怀仪式）
  - **混合型**：平衡练习（觉察何时焦虑、何时回避）

---

### 7️⃣ 写在最后（150-200字）

- 回顾用户的核心议题
- 强调：你不是"有问题"，你只是在用童年学会的方式保护自己
- 鼓励寻求专业帮助（不是每个人都需要，但如果痛苦持续，这是勇敢的选择）
- 结束语：温暖、有力量、给予希望

---

## 写作要求（必须严格遵守）

### 语言风格

1. **第二人称"你"**：营造一对一咨询的亲密感
2. **温暖但不矫情**：共情但不煽情，专业但不冰冷
3. **具体化**：少用"可能""也许"，多用具体分析
4. **生活化场景**：用日常关系场景举例，如"当伴侣晚回消息时，你会……"
5. **避免说教**：不要用"你应该""你必须"，改用"你可以尝试""建议……"

### 专业性

1. 每个结论都有依据：理论+数据
2. 引用经典研究或理论家（Bowlby、Ainsworth、Bartholomew、Main等）
3. 术语解释：首次出现专业术语时用括号注释
4. 避免过度病理化：不说"你有病"，说"这是自然的保护反应"

### 结构性

1. 使用**加粗**标记章节标题
2. 适当使用emoji增加可读性（每个大标题前）
3. 重点内容用**加粗**
4. 每个大章节开头用一句话概括本章内容
5. 禁用#符号

### 个性化

1. **不要套模板**，要像真正分析过用户数据一样
2. 根据用户的依恋类型调整语言风格和关注重点
3. 如果某些得分极端（很高或很低），必须重点分析

---

## 禁止事项（绝对不要）

❌ 使用"患者""病症"等医学化语言
❌ 给出明确精神疾病诊断（如"你有边缘型人格障碍"）
❌ 承诺"一定能治愈""完全改变"
❌ 建议具体药物或替代疗法
❌ 简单复制依恋类型的百科定义
❌ 字数不足6000字
❌ 使用#符号作为标题

---

现在，请基于以上所有数据和要求，生成这份深度报告。像你正在为一位真实的来访者写咨询报告一样，用心、专业、温暖。直接输出正文。`;

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
            content: '你是一位资深的依恋理论心理专家，擅长提供深度、温暖、专业的心理分析。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 12000,
        frequency_penalty: 0.3,
        top_p: 0.9
      }),
      signal: AbortSignal.timeout(90000) // 90秒超时，7000字报告需要更长时间
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
