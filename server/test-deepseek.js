const fetch = require('node-fetch');

const API_KEY = 'sk-448ce19cde5643e7894695332072dd58';
const API_URL = 'https://api.deepseek.com/v1/chat/completions';

async function testDeepSeek() {
  console.log('Testing DeepSeek API...');
  
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: '你是一位专业的心理咨询师。',
          },
          {
            role: 'user',
            content: '请简短地介绍一下恋爱健康指数。',
          },
        ],
        temperature: 0.7,
        max_tokens: 200,
      }),
    });

    console.log('Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error response:', errorText);
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ Success!');
    console.log('Response:', JSON.stringify(data, null, 2));
    
    if (data.choices && data.choices[0]) {
      console.log('\n📝 AI回复:', data.choices[0].message.content);
    }
  } catch (error) {
    console.error('❌ Failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response);
    }
  }
}

testDeepSeek();
