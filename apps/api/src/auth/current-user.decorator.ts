import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest } from './auth.guard.js';

/**
 * Lấy user của session hiện tại (do AuthGuard gắn vào request).
 * Chỉ dùng trên route đã @UseGuards(AuthGuard).
 */
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
  return request.sessionUser;
});
