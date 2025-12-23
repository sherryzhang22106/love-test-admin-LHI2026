import prisma from '../config/database';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

async function seed() {
  console.log('🌱 Starting database seed...');

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@lhi.local';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123456';

  const existingAdmin = await prisma.admin.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    await prisma.admin.create({
      data: {
        email: adminEmail,
        password: hashedPassword,
        name: 'System Admin',
        role: 'admin',
      },
    });
    console.log(`✅ Admin created: ${adminEmail} / ${adminPassword}`);
  } else {
    console.log('ℹ️  Admin already exists');
  }

  const codeCount = await prisma.accessCode.count();
  if (codeCount === 0) {
    const testCodes = ['LHI12345', 'LHITEST01', 'LHITEST02', 'LHITEST03'];
    await prisma.accessCode.createMany({
      data: testCodes.map(code => ({
        code,
        batchId: 'INITIAL_SEED',
      })),
    });
    console.log(`✅ Created ${testCodes.length} test access codes`);
  } else {
    console.log(`ℹ️  ${codeCount} access codes already exist`);
  }

  console.log('✅ Seed completed!');
  await prisma.$disconnect();
}

seed().catch((error) => {
  console.error('❌ Seed failed:', error);
  process.exit(1);
});
