import { UserRole } from '../generated/prisma/enums.js';
import { reconcileAdmins } from './admin-reconcile.js';
import { prisma } from './auth.config.js';

/**
 * Integration (Docker PG, db tourism_test) — AUTH-1 self-heal (ADR-0008).
 * `reconcileAdmins` promote user hiện có thỏa (emailVerified ∧ email ∈ ADMIN_EMAILS),
 * promote-only.
 */

const A1 = 'admin-one@tourism.test';
const A2 = 'admin-two@tourism.test';

describe('reconcileAdmins (AUTH-1 self-heal)', () => {
  beforeEach(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE TABLE users CASCADE');
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const roleOf = async (email: string): Promise<UserRole> =>
    (await prisma.user.findUniqueOrThrow({ where: { email } })).role;

  it('promote user verified ∈ ADMIN_EMAILS; bỏ unverified + không-phải-admin; idempotent', async () => {
    await prisma.user.createMany({
      data: [
        { email: A1, emailVerified: true, role: UserRole.CUSTOMER, name: 'A1' },
        { email: 'someone@x.com', emailVerified: true, role: UserRole.CUSTOMER, name: 'S' },
        { email: A2, emailVerified: false, role: UserRole.CUSTOMER, name: 'A2' },
      ],
    });

    expect(await reconcileAdmins(prisma, [A1, A2])).toBe(1); // chỉ A1

    expect(await roleOf(A1)).toBe(UserRole.ADMIN); // verified admin → promote
    expect(await roleOf('someone@x.com')).toBe(UserRole.CUSTOMER); // không phải admin
    expect(await roleOf(A2)).toBe(UserRole.CUSTOMER); // unverified → không

    expect(await reconcileAdmins(prisma, [A1, A2])).toBe(0); // idempotent
    expect(await roleOf(A1)).toBe(UserRole.ADMIN);
  });

  it('promote-only — KHÔNG demote admin có sẵn dù không ∈ ADMIN_EMAILS', async () => {
    await prisma.user.create({
      data: { email: 'ex-admin@x.com', emailVerified: true, role: UserRole.ADMIN, name: 'X' },
    });
    await reconcileAdmins(prisma, [A1]);
    expect(await roleOf('ex-admin@x.com')).toBe(UserRole.ADMIN);
  });

  it('ADMIN_EMAILS rỗng → không làm gì', async () => {
    await prisma.user.create({
      data: { email: A1, emailVerified: true, role: UserRole.CUSTOMER, name: 'A' },
    });
    expect(await reconcileAdmins(prisma, [])).toBe(0);
    expect(await roleOf(A1)).toBe(UserRole.CUSTOMER);
  });
});
