import { Module } from '@nestjs/common';
import { BookingsModule } from '../bookings/bookings.module.js';
import { CatalogModule } from '../catalog/catalog.module.js';
import { EnquiriesModule } from '../enquiries/enquiries.module.js';
import { ChatController } from './chat.controller.js';
import { ChatService } from './chat.service.js';
import { chatConfigProviders } from './chat-config.js';

/**
 * P6 trợ lý AI tư vấn tour (ADR-0050). Tool gọi thẳng `CatalogService`,
 * `EnquiriesService` và `BookingsService` (đọc đơn của chính khách, AMEND 2), nên ba
 * module ấy export service của mình.
 */
@Module({
  imports: [CatalogModule, EnquiriesModule, BookingsModule],
  controllers: [ChatController],
  providers: [...chatConfigProviders, ChatService],
})
export class ChatModule {}
