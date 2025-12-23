const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const codes = ['LHITEST01', 'LHITEST02', 'LHITEST03', 'LHITEST04', 'LHITEST05'];
  
  for (const code of codes) {
    try {
      await prisma.accessCode.create({
        data: {
          code,
          batchId: 'TEST_BATCH',
        },
      });
      console.log(`✓ Created: ${code}`);
    } catch (e) {
      console.log(`✗ ${code} already exists`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch(console.error);
