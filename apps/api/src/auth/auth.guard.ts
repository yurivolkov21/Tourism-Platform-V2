import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
// NB: Reflector phải là VALUE import — Nest DI đọc design:paramtypes từ
// decorator metadata; `import type` làm metadata thành undefined.
import { Reflector } from '@nestjs/core';
import { fromNodeHeaders } from 'better-auth/node';
import type { FastifyRequest } from 'fastify';
import type { UserRole } from '../generated/prisma/enums.js';
import { auth, type SessionUser } from './auth.config.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';
import { ROLES_KEY } from './roles.decorator.js';

/** Request đã qua AuthGuard mang user của session BA. */
export interface AuthenticatedRequest extends FastifyRequest {
  sessionUser: SessionUser;
}

/**
 * Đọc session Better Auth từ cookie/header (thay JWT Supabase của Nexora).
 * 401: không có session, user đã tombstone (deletedAt set) HOẶC đang bị khoá
 * (lockedAt set, ADR-0052) — defense in depth, hai luồng ấy vốn đã xoá hết
 * session. 403: thiếu role @Roles yêu cầu.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Guard này chạy TOÀN CỤC (ADR-0003) nên phải thoát sớm cho route
    // public — trước khi gọi getSession(), để route public không tốn thêm
    // một lượt đọc session.
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<FastifyRequest>();

    const session = await auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });
    // 401 khi tombstone HOẶC bị khoá (ADR-0052 §4). Lệnh khoá đã xoá mọi phiên và hook chặn
    // phiên mới; vế `lockedAt` bịt khe hở một phiên được ghi đúng lúc lệnh khoá đang chạy.
    if (!session || session.user.deletedAt != null || session.user.lockedAt != null) {
      throw new UnauthorizedException();
    }

    const requiredRoles = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (requiredRoles && requiredRoles.length > 0) {
      const role = session.user.role as UserRole;
      if (!requiredRoles.includes(role)) {
        throw new ForbiddenException();
      }
    }

    (request as AuthenticatedRequest).sessionUser = session.user;
    return true;
  }
}
