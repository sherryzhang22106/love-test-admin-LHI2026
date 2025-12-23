import bcrypt from 'bcryptjs';
import prisma from '../config/database';
import { generateToken } from '../utils/jwt';

export class AuthService {
  static async registerUser(email: string, password: string, username?: string) {
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { username: username || '' },
        ],
      },
    });

    if (existingUser) {
      throw new Error('User already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        role: 'user',
      },
    });

    const token = generateToken({
      id: user.id,
      email: user.email!,
      role: user.role,
    });

    return { user: { id: user.id, email: user.email, username: user.username }, token };
  }

  static async loginUser(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.password) {
      throw new Error('Invalid credentials');
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      throw new Error('Invalid credentials');
    }

    const token = generateToken({
      id: user.id,
      email: user.email!,
      role: user.role,
    });

    return { user: { id: user.id, email: user.email, username: user.username }, token };
  }

  static async loginAdmin(email: string, password: string) {
    const admin = await prisma.admin.findUnique({ where: { email } });

    if (!admin) {
      throw new Error('Invalid credentials');
    }

    const validPassword = await bcrypt.compare(password, admin.password);
    if (!validPassword) {
      throw new Error('Invalid credentials');
    }

    const token = generateToken({
      id: admin.id,
      email: admin.email,
      role: admin.role,
    });

    return { admin: { id: admin.id, email: admin.email, name: admin.name }, token };
  }

  static async createAdmin(email: string, password: string, name: string) {
    const existingAdmin = await prisma.admin.findUnique({ where: { email } });

    if (existingAdmin) {
      throw new Error('Admin already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const admin = await prisma.admin.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: 'admin',
      },
    });

    return { id: admin.id, email: admin.email, name: admin.name };
  }
}
