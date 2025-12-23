import prisma from '../config/database';
import crypto from 'crypto';

// Product types supported
export type ProductType = 'LHI' | 'LCI' | 'ASA' | 'ALL';

// Master codes that can be reused (per product)
// Each master code maps to an array of allowed product types
const MASTER_CODES: Record<string, ProductType[]> = {
  'LHI159951': ['LHI'],      // Only for LHI
  'LCI2025': ['LCI'],        // Only for LCI
  'ASA2025': ['ASA'],        // Only for ASA (依恋风格测评)
  'ALL2025': ['LHI', 'LCI', 'ASA'],  // All products
};

export class AccessCodeService {
  static async generateCodes(count: number, batchId?: string, productType: ProductType = 'LHI'): Promise<any[]> {
    const codes: any[] = [];
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

    // SQLite doesn't support skipDuplicates in createMany
    // Use individual creates instead
    const batchIdValue = batchId || `BATCH_${Date.now()}`;

    for (let i = 0; i < count; i++) {
      let code = '';
      for (let j = 0; j < 8; j++) {
        const randomIndex = crypto.randomInt(0, chars.length);
        code += chars[randomIndex];
      }

      try {
        const created = await prisma.accessCode.create({
          data: {
            code,
            productType,
            batchId: batchIdValue,
          },
        });
        codes.push(created);
      } catch (error: any) {
        // Skip if duplicate
        if (error.code === 'P2002') {
          console.log(`Skipping duplicate code: ${code}`);
        } else {
          throw error;
        }
      }
    }

    return codes;
  }

  static async validateCode(code: string, productType: ProductType = 'LHI'): Promise<{ valid: boolean; accessCodeId?: string; message?: string }> {
    const upperCode = code.toUpperCase();

    // Check if it's a master code
    if (MASTER_CODES[upperCode]) {
      const allowedProducts = MASTER_CODES[upperCode];
      if (!allowedProducts.includes(productType)) {
        // Master code exists but not valid for this product
        const productNames: Record<string, string> = {
          'LHI': '爱情健康指数',
          'LCI': '爱情浓度指数',
          'ASA': '依恋风格深度测评',
          'ALL': '全部产品'
        };
        return { valid: false, message: `此兑换码不适用于 ${productNames[productType]} 测试` };
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

      return { valid: true, accessCodeId: accessCode.id };
    }

    const accessCode = await prisma.accessCode.findUnique({
      where: { code: upperCode },
    });

    if (!accessCode) {
      return { valid: false, message: 'Invalid access code' };
    }

    // Check if code is valid for this product type
    if (accessCode.productType !== 'ALL' && accessCode.productType !== productType) {
      return { valid: false, message: `This code is not valid for ${productType}` };
    }

    if (accessCode.isUsed) {
      return { valid: false, message: 'Access code already used' };
    }

    return { valid: true, accessCodeId: accessCode.id };
  }

  static async markCodeAsUsed(accessCodeId: string, ipAddress?: string): Promise<void> {
    const code = await prisma.accessCode.findUnique({
      where: { id: accessCodeId },
    });

    // Don't mark master codes as used
    if (code && MASTER_CODES[code.code]) {
      return;
    }

    await prisma.accessCode.update({
      where: { id: accessCodeId },
      data: {
        isUsed: true,
        usedAt: new Date(),
        usedByIp: ipAddress,
      },
    });
  }

  static async getCodeStats(productType?: ProductType) {
    const where = productType ? { productType } : {};
    const total = await prisma.accessCode.count({ where });
    const used = await prisma.accessCode.count({ where: { ...where, isUsed: true } });
    const available = total - used;

    // Get stats per product if no filter
    let byProduct = null;
    if (!productType) {
      const lhiTotal = await prisma.accessCode.count({ where: { productType: 'LHI' } });
      const lhiUsed = await prisma.accessCode.count({ where: { productType: 'LHI', isUsed: true } });
      const lciTotal = await prisma.accessCode.count({ where: { productType: 'LCI' } });
      const lciUsed = await prisma.accessCode.count({ where: { productType: 'LCI', isUsed: true } });
      const asaTotal = await prisma.accessCode.count({ where: { productType: 'ASA' } });
      const asaUsed = await prisma.accessCode.count({ where: { productType: 'ASA', isUsed: true } });
      const allTotal = await prisma.accessCode.count({ where: { productType: 'ALL' } });
      const allUsed = await prisma.accessCode.count({ where: { productType: 'ALL', isUsed: true } });

      byProduct = {
        LHI: { total: lhiTotal, used: lhiUsed, available: lhiTotal - lhiUsed },
        LCI: { total: lciTotal, used: lciUsed, available: lciTotal - lciUsed },
        ASA: { total: asaTotal, used: asaUsed, available: asaTotal - asaUsed },
        ALL: { total: allTotal, used: allUsed, available: allTotal - allUsed },
      };
    }

    return { total, used, available, byProduct };
  }

  static async listCodes(page: number = 1, limit: number = 50, filter?: 'all' | 'used' | 'available', productType?: ProductType) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (filter === 'used') where.isUsed = true;
    else if (filter === 'available') where.isUsed = false;

    if (productType) where.productType = productType;

    const [codes, total] = await Promise.all([
      prisma.accessCode.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          code: true,
          productType: true,
          isUsed: true,
          usedAt: true,
          usedByIp: true,
          batchId: true,
          createdAt: true,
        },
      }),
      prisma.accessCode.count({ where }),
    ]);

    return {
      codes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
