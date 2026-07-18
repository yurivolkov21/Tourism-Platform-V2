import { Module } from '@nestjs/common';
import { AccountController } from './account.controller.js';
import { AccountService } from './account.service.js';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';

@Module({
  controllers: [AuthController, AccountController],
  providers: [AccountService, AuthGuard],
  exports: [AuthGuard],
})
export class AuthModule {}
