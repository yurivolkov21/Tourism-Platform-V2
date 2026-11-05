import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import { RootController } from './root.controller.js';

@Module({
  // RootController (`GET /`) chỉ trỏ tới các probe nên ở chung module với chúng.
  controllers: [HealthController, RootController],
})
export class HealthModule {}
