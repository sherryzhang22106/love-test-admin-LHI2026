const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    // Delete if exists
    await prisma.accessCode.deleteMany({
      where: { code: 'LHI159951' }
    });
    
    // Create master code
    await prisma.accessCode.create({
      data: {
        code: 'LHI159951',
        batchId: 'MASTER_CODE',
        isUsed: false,
      },
    });
    console.log('✓ 已创建万能测试码: LHI159951');
  } catch (e) {
    console.log('Error:', e.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch(console.error);
