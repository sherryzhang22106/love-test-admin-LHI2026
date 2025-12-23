const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const codes = ['LHITEST06', 'LHITEST07', 'LHITEST08', 'LHITEST09', 'LHITEST10'];
  
  for (const code of codes) {
    try {
      await prisma.accessCode.create({
        data: {
          code,
          batchId: 'TEST_BATCH_2',
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
