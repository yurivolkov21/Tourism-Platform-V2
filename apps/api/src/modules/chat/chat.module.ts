import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module.js';
import { EnquiriesModule } from '../enquiries/enquiries.module.js';
import { ChatController } from './chat.controller.js';
import { ChatService } from './chat.service.js';
import { chatConfigProviders } from './chat-config.js';

/**
 * P6 trợ lý AI tư vấn tour (ADR-0050). Tool gọi thẳng `CatalogService` và
 * `EnquiriesService`, nên hai module ấy export service của mình.
 */
@Module({
  imports: [CatalogModule, EnquiriesModule],
  controllers: [ChatController],
  providers: [...chatConfigProviders, ChatService],
})
export class ChatModule {}
