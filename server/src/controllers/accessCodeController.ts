import { Request, Response } from 'express';
import { AccessCodeService, ProductType } from '../services/accessCodeService';
import { z } from 'zod';

const generateCodesSchema = z.object({
  count: z.number().min(1).max(10000),
  batchId: z.string().optional(),
  productType: z.enum(['LHI', 'LCI', 'ASA', 'ALL']).optional().default('LHI'),
});

const validateCodeSchema = z.object({
  code: z.string(),
  productType: z.enum(['LHI', 'LCI', 'ASA', 'ALL']).optional().default('LHI'),
});

export class AccessCodeController {
  static async generateCodes(req: Request, res: Response) {
    try {
      const data = generateCodesSchema.parse(req.body);
      const codes = await AccessCodeService.generateCodes(data.count, data.batchId, data.productType as ProductType);
      res.status(201).json({ codes, count: codes.length });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async validateCode(req: Request, res: Response) {
    try {
      const data = validateCodeSchema.parse(req.body);
      const result = await AccessCodeService.validateCode(data.code, data.productType as ProductType);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async getStats(req: Request, res: Response) {
    try {
      const productType = req.query.productType as ProductType | undefined;
      const stats = await AccessCodeService.getCodeStats(productType);
      res.json(stats);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async listCodes(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const filter = (req.query.filter as 'all' | 'used' | 'available') || 'all';
      const productType = req.query.productType as ProductType | undefined;

      const result = await AccessCodeService.listCodes(page, limit, filter, productType);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
}
