const crypto = require('crypto');

// 生成8位大写字母+数字兑换码
function generateCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let j = 0; j < 8; j++) {
    const randomIndex = crypto.randomInt(0, chars.length);
    code += chars[randomIndex];
  }
  return code;
}

// 生成10个测试码
console.log('新的8位兑换码格式示例：');
for (let i = 0; i < 10; i++) {
  console.log(`${i + 1}. ${generateCode()}`);
}
