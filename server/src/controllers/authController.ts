import { Request, Response } from 'express';
import { AuthService } from '../services/authService';
import { z } from 'zod';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  username: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export class AuthController {
  static async register(req: Request, res: Response) {
    try {
      const data = registerSchema.parse(req.body);
      const result = await AuthService.registerUser(data.email, data.password, data.username);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async login(req: Request, res: Response) {
    try {
      const data = loginSchema.parse(req.body);
      const result = await AuthService.loginUser(data.email, data.password);
      res.json(result);
    } catch (error: any) {
      res.status(401).json({ error: error.message });
    }
  }

  static async adminLogin(req: Request, res: Response) {
    try {
      const data = loginSchema.parse(req.body);
      const result = await AuthService.loginAdmin(data.email, data.password);
      res.json(result);
    } catch (error: any) {
      res.status(401).json({ error: error.message });
    }
  }
}
