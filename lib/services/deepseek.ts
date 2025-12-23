interface DeepSeekAnalysis {
  resultInterpretation: string;
  personalizedAdvice: string;
  strengths: string;
  areasToWatch: string;
  professionalAdvice: string;
}

interface DeepSeekAnalysis {
  resultInterpretation: string;
  personalizedAdvice: string;
  strengths: string;
  areasToWatch: string;
  professionalAdvice: string;
}

export async function generateAIAnalysis(
  totalScore: number,
  category: string,
  attachmentStyle: string,
  dimensions: Array<{ id: string; name: string; rawScore: number; tScore: number; level: string }>
): Promise<DeepSeekAnalysis> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  
  console.log('generateAIAnalysis called, has API key:', !!apiKey);
  
  if (!apiKey) {
    console.warn('DEEPSEEK_API_KEY not configured, using fallback');
    return getFallbackAnalysis(totalScore, category, attachmentStyle);
  }

  try {
    const prompt = buildPrompt(totalScore, category, attachmentStyle, dimensions);
    
    console.log('Calling DeepSeek API...');
    const response = await Promise.race([
      fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: '你是专业心理咨询师。必须严格按照用户要求的格式输出，每个###标题后都要有独立的内容段落。',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    }),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('DeepSeek API timeout')), 15000)
    )
    ]) as Response;

    console.log('DeepSeek API response status:', response.status);
    
    if (!response.ok) {
      console.error(`DeepSeek API error: ${response.status}`);
      return getFallbackAnalysis(totalScore, category, attachmentStyle);
    }

    const data: any = await response.json();
    const content = data.choices[0]?.message?.content || '';
    
    console.log('DeepSeek API response received, length:', content.length);
    
    // Parse the response into structured format
    const parsed = parseAnalysisResponse(content);
    console.log('Parsed analysis, has resultInterpretation:', !!parsed.resultInterpretation);
    return parsed;
  } catch (error: any) {
    console.error('DeepSeek API call failed:', error.message);
    console.log('Using fallback analysis');
    return getFallbackAnalysis(totalScore, category, attachmentStyle);
  }
}

function buildPrompt(
  totalScore: number,
  category: string,
  attachmentStyle: string,
  dimensions: Array<{ id: string; name: string; rawScore: number; tScore: number; level: string }>
): string {
  const dimensionDetails = dimensions.map(d => 
    `${d.name}: T分${d.tScore} (${d.level === 'High' ? '健康' : d.level === 'Low' ? '需关注' : '中等'})`
  ).join(', ');

  return `【恋爱健康指数评估结果】
总分：${totalScore}/100 (${category})
依恋风格：${attachmentStyle}
各维度：${dimensionDetails}

【评分说明】
- LHI总分 0-100：越高越健康
- 0-30=脆弱，31-50=偏低，51-70=平均，71-100=健康
- T分数越高=该维度越健康

请严格按以下格式输出5个独立部分（各100-150字）：

### 结果解释
解释LHI ${totalScore}分的含义，说明${attachmentStyle}的核心特征。

### 你的优势
指出健康维度（T分数≥50），肯定积极特质。

### 需要注意的方面
指出需改善维度（T分数<50），说明潜在风险。

### 个性化建议
针对需改善的具体维度给出实际可行的方法。

### 专业建议
提供系统的成长方向和练习建议。

重要：每个###后必须有独立完整的段落内容！`;
}

function parseAnalysisResponse(content: string): DeepSeekAnalysis {
  const sections = {
    resultInterpretation: '',
    strengths: '',
    areasToWatch: '',
    personalizedAdvice: '',
    professionalAdvice: ''
  };

  const parts = content.split(/###\s*/);
  
  for (const part of parts) {
    const trimmedPart = part.trim();
    if (!trimmedPart) continue;
    
    if (trimmedPart.startsWith('结果解释')) {
      sections.resultInterpretation = trimmedPart.replace(/^结果解释[：:\s]*/, '').trim();
    } else if (trimmedPart.startsWith('你的优势') || trimmedPart.startsWith('优势')) {
      sections.strengths = trimmedPart.replace(/^(你的)?优势[：:\s]*/, '').trim();
    } else if (trimmedPart.startsWith('需要注意')) {
      sections.areasToWatch = trimmedPart.replace(/^需要注意(的方面)?[：:\s]*/, '').trim();
    } else if (trimmedPart.startsWith('个性化建议')) {
      sections.personalizedAdvice = trimmedPart.replace(/^个性化建议[：:\s]*/, '').trim();
    } else if (trimmedPart.startsWith('专业建议')) {
      sections.professionalAdvice = trimmedPart.replace(/^专业建议[：:\s]*/, '').trim();
    }
  }

  // If parsing failed, return fallback with the content
  if (!sections.resultInterpretation) {
    return {
      resultInterpretation: content || '暂无分析内容',
      strengths: '',
      areasToWatch: '',
      personalizedAdvice: '',
      professionalAdvice: ''
    };
  }

  return sections;
}

function getFallbackAnalysis(
  totalScore: number,
  category: string,
  attachmentStyle: string
): DeepSeekAnalysis {
  return {
    resultInterpretation: `您的恋爱健康指数为 ${totalScore} 分，处于${category}水平。这个分数反映了您当前恋爱关系的整体健康状况。您的依恋风格是${attachmentStyle}型，这会影响您在亲密关系中的互动模式和情感表达方式。`,
    strengths: '您已经迈出了重要的一步，愿意了解和改善自己的恋爱关系。这种自我觉察能力是建立健康关系的基础。您对关系的投入和关注体现了您对亲密关系的重视。',
    areasToWatch: `请关注可能影响关系质量的因素，包括情绪管理、沟通方式和依恋模式。${totalScore < 50 ? '当前分数偏低，建议重点关注关系中的互动模式和情感需求。' : '保持当前的积极态势，继续优化关系品质。'}`,
    personalizedAdvice: '建议您关注自己在关系中的情绪模式，学会识别和表达自己的需求。保持开放的沟通，建立健康的边界，同时也要给予伴侣足够的信任和空间。可以尝试记录情绪日记，提高自我觉察能力。',
    professionalAdvice: '建议定期进行自我反思，必要时可以考虑寻求专业心理咨询。通过系统的学习和实践，您可以培养更健康的恋爱模式。推荐阅读相关心理学书籍，参加情感关系工作坊，持续提升关系质量。'
  };
}

// Legacy string format function (kept for backward compatibility)
function getFallbackAnalysisString(
  totalScore: number,
  category: string,
  attachmentStyle: string
): string {
  return `### 结果解释
您的恋爱健康指数为 ${totalScore} 分，处于${category}水平。这个分数反映了您当前恋爱关系的整体健康状况。您的依恋风格是${attachmentStyle}型，这会影响您在亲密关系中的互动模式和情感表达方式。

### 你的优势
您已经迈出了重要的一步，愿意了解和改善自己的恋爱关系。这种自我觉察能力是建立健康关系的基础。您对关系的投入和关注体现了您对亲密关系的重视。

### 需要注意的方面
请关注可能影响关系质量的因素，包括情绪管理、沟通方式和依恋模式。${totalScore < 50 ? '当前分数偏低，建议重点关注关系中的互动模式和情感需求。' : '保持当前的积极态势，继续优化关系品质。'}

### 个性化建议
建议您关注自己在关系中的情绪模式，学会识别和表达自己的需求。保持开放的沟通，建立健康的边界，同时也要给予伴侣足够的信任和空间。可以尝试记录情绪日记，提高自我觉察能力。

### 专业建议
建议定期进行自我反思，必要时可以考虑寻求专业心理咨询。通过系统的学习和实践，您可以培养更健康的恋爱模式。推荐阅读相关心理学书籍，参加情感关系工作坊，持续提升关系质量。`;
}
