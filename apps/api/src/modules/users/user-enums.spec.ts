import { UserEventTypeSchema, UserRoleSchema } from '@tourism/contract';
import { describe, expect, it } from 'vitest';
import { UserEventType, UserRole } from '../../generated/prisma/enums.js';

/**
 * Contract và Prisma giữ hai bản của cùng hai enum (plan P4f, quyết định 15). Một bên thêm
 * giá trị mà bên kia quên thì zod từ chối đúng giá trị DB vừa trả — test này đỏ trước.
 */
describe('enum người dùng: contract soi gương Prisma', () => {
  it('UserRoleSchema khớp UserRole, cả thứ tự', () => {
    expect([...UserRoleSchema.options]).toEqual(Object.values(UserRole));
  });

  it('UserEventTypeSchema khớp UserEventType, cả thứ tự', () => {
    expect([...UserEventTypeSchema.options]).toEqual(Object.values(UserEventType));
  });
});
