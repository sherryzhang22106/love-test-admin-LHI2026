import type { VercelRequest, VercelResponse } from '@vercel/node';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Master codes that can be reused (per product)
// Each master code maps to an array of allowed product types
const MASTER_CODES: Record<string, string[]> = {
  'LHI159951': ['LHI'],      // Only for LHI
  'LCI2025': ['LCI'],        // Only for LCI
  'ASA2025': ['ASA'],        // Only for ASA (依恋风格测评)
  'ALL2025': ['LHI', 'LCI', 'ASA'],  // All products
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { code, productType = 'LHI' } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Access code is required' });
    }

    if (!['LHI', 'LCI', 'ASA'].includes(productType)) {
      return res.status(400).json({ error: 'Invalid product type' });
    }

    const upperCode = code.trim().toUpperCase();

    // Check if it's a master code
    if (MASTER_CODES[upperCode]) {
      const allowedProducts = MASTER_CODES[upperCode];
      if (!allowedProducts.includes(productType)) {
        // Master code exists but not valid for this product
        const productNames: Record<string, string> = {
          'LHI': '爱情健康指数',
          'LCI': '爱情浓度指数',
          'ASA': '依恋风格深度测评'
        };
        return res.status(400).json({
          valid: false,
          message: `此兑换码不适用于 ${productNames[productType]} 测试`
        });
      }

      // Valid master code for this product - find or create in database
      let accessCode = await prisma.accessCode.findUnique({
        where: { code: upperCode },
      });

      if (!accessCode) {
        accessCode = await prisma.accessCode.create({
          data: {
            code: upperCode,
            productType: productType,
            batchId: 'MASTER',
          },
        });
      }

      return res.status(200).json({
        valid: true,
        accessCodeId: accessCode.id
      });
    }

    const accessCode = await prisma.accessCode.findUnique({
      where: { code: upperCode }
    });

    if (!accessCode) {
      return res.status(404).json({
        valid: false,
        message: '兑换码不存在'
      });
    }

    // Check if code is valid for this product type
    if (accessCode.productType !== 'ALL' && accessCode.productType !== productType) {
      return res.status(400).json({
        valid: false,
        message: `此兑换码不适用于 ${productType}`
      });
    }

    if (accessCode.isUsed) {
      return res.status(400).json({
        valid: false,
        message: '兑换码已被使用'
      });
    }

    return res.status(200).json({
      valid: true,
      accessCodeId: accessCode.id
    });
  } catch (error: any) {
    console.error('Validate access code error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    await prisma.$disconnect();
  }
}
