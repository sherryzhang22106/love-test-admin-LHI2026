import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

// Singleton pattern for Prisma in serverless
let prisma: PrismaClient | null = null;

function getPrisma() {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const db = getPrisma();
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Check if admin exists
    let admin = await db.admin.findUnique({
      where: { email }
    });

    // If no admin exists, create default admin
    if (!admin) {
      const defaultEmail = process.env.ADMIN_EMAIL || 'admin@lhi.local';
      const defaultPassword = process.env.ADMIN_PASSWORD || 'admin123456';
      
      if (email === defaultEmail) {
        const hashedPassword = await bcrypt.hash(defaultPassword, 10);
        admin = await db.admin.create({
          data: {
            email: defaultEmail,
            password: hashedPassword,
            name: 'Admin',
            role: 'admin'
          }
        });
      } else {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, admin.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const jwtSecret = process.env.JWT_SECRET || 'default-secret-key';
    const token = jwt.sign(
      { userId: admin.id, email: admin.email, role: admin.role },
      jwtSecret,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    return res.status(200).json({
      token,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role
      }
    });
  } catch (error: any) {
    console.error('Admin login error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
