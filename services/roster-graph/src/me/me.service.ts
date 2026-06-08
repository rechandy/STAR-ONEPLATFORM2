import { Injectable, NotFoundException } from '@nestjs/common';
import { LicenseStatus, Product, RoleType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const ALL_PRODUCTS: Product[] = [Product.LINKS, Product.SOLER, Product.SOLS, Product.MEDIA_CENTER];

@Injectable()
export class MeService {
  constructor(private readonly prisma: PrismaService) {}

  /** The acting user's identity + org memberships (for the dashboard shell). */
  async me(tenantId: string, staffId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: staffId, tenantId },
      select: { id: true, givenName: true, familyName: true, primaryRole: true },
    });
    if (!user) throw new NotFoundException(`User ${staffId} not found.`);

    const memberships = await this.prisma.orgMembership.findMany({
      where: { tenantId, userId: staffId },
      include: { org: { select: { id: true, name: true, type: true } } },
    });

    const isAdmin =
      user.primaryRole === RoleType.ADMINISTRATOR || user.primaryRole === RoleType.DISTRICT_ADMIN;

    return {
      id: user.id,
      name: `${user.givenName} ${user.familyName}`,
      role: user.primaryRole,
      tenantId,
      isAdmin,
      orgs: memberships.map((m) => ({ id: m.org.id, name: m.org.name, type: m.org.type, role: m.role })),
    };
  }

  /** The tenant's pillar entitlements (active, non-expired licenses). */
  async licenses(tenantId: string) {
    const now = new Date();
    const rows = await this.prisma.productLicense.findMany({
      where: { tenantId, status: LicenseStatus.ACTIVE },
    });
    const active = new Set(
      rows.filter((l) => !l.expiresAt || l.expiresAt > now).map((l) => l.product),
    );
    return {
      tenantId,
      products: ALL_PRODUCTS.map((product) => ({ product, licensed: active.has(product) })),
    };
  }
}
