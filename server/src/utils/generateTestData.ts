import prisma from '../config/database';
import dotenv from 'dotenv';

dotenv.config();

async function generateTestData() {
  console.log('🧪 Generating test assessment data...');

  try {
    // Get or create test access codes
    const codes = await prisma.accessCode.findMany({
      where: { batchId: 'INITIAL_SEED' },
      take: 3,
    });

    if (codes.length === 0) {
      console.log('❌ No test access codes found. Please run seed first.');
      await prisma.$disconnect();
      return;
    }

    const categories = ['脆弱的爱', '平均以下', '平均水平', '健康的爱'];
    const attachmentStyles = ['安全型', '焦虑型', '回避型', '恐惧型'];
    const dimensions = [
      { id: 'd1', name: '依恋焦虑', count: 1 },
      { id: 'd2', name: '依恋回避', count: 1 },
      { id: 'd3', name: '控制欲', count: 1 },
      { id: 'd4', name: '嫉妒强度', count: 1 },
      { id: 'd5', name: '情感依赖', count: 1 },
      { id: 'd6', name: '关系不安全感', count: 1 },
    ];

    // Generate 15 test assessments with varied data
    for (let i = 0; i < 15; i++) {
      const codeIndex = i % codes.length;
      const code = codes[codeIndex];
      const totalScore = Math.floor(Math.random() * 100);
      const category = categories[Math.floor(Math.random() * categories.length)];
      const attachmentStyle = attachmentStyles[Math.floor(Math.random() * attachmentStyles.length)];

      // Generate random dimension data
      const dimensionData = dimensions.map(d => ({
        id: d.id,
        name: d.name,
        rawScore: Math.floor(Math.random() * 5) + 1,
        tScore: Math.floor(Math.random() * 40) + 30,
        level: Math.random() > 0.5 ? 'High' : 'Low',
      }));

      // Generate answers
      const answers: Record<string, number> = {};
      for (let j = 1; j <= 40; j++) {
        answers[`q${j}`] = Math.floor(Math.random() * 5) + 1;
      }

      // Create assessment
      await prisma.assessment.create({
        data: {
          accessCodeId: code.id,
          totalScore,
          category,
          attachmentStyle,
          dimensions: JSON.stringify(dimensionData),
          answers: JSON.stringify(answers),
          aiAnalysis: JSON.stringify({
            resultInterpretation: `恋爱健康指数为 ${totalScore} 分，反映了当前关系的整体状况。`,
            strengths: '您已经表现出良好的自我认知和改变意愿。',
            areasToWatch: '关注情绪管理和沟通方式的改善。',
            personalizedAdvice: '建议定期进行自我反思和沟通练习。',
            professionalAdvice: '可以考虑寻求专业心理咨询的帮助。',
          }),
          ipAddress: `192.168.1.${Math.floor(Math.random() * 255)}`,
        },
      });

      console.log(`✅ Created assessment ${i + 1}/15 (${attachmentStyle})`);
    }

    console.log('✅ Test data generation completed!');

  } catch (error) {
    console.error('❌ Error generating test data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

generateTestData();
