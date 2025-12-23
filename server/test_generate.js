const crypto = require('crypto');

function generateCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  try {
    for (let j = 0; j < 8; j++) {
      const randomIndex = crypto.randomInt(0, chars.length);
      code += chars[randomIndex];
    }
    return code;
  } catch (error) {
    console.error('Error in generateCode:', error);
    throw error;
  }
}

console.log('Testing code generation...');
try {
  for (let i = 0; i < 5; i++) {
    console.log(`${i + 1}. ${generateCode()}`);
  }
  console.log('✅ Code generation successful');
} catch (error) {
  console.error('❌ Code generation failed:', error);
}
