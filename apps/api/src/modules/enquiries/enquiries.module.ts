import { Module } from '@nestjs/common';
import { AdminEnquiriesController } from './admin-enquiries.controller.js';
import { AdminEnquiriesService } from './admin-enquiries.service.js';
import { EnquiriesController } from './enquiries.controller.js';
import { EnquiriesService } from './enquiries.service.js';

/**
 * F9 (spec P4c §3-F9, §2.1 "mỗi vùng một module — enquiries thêm admin-*"):
 * bề mặt CRM cho admin ở chung nhà với form công khai vì cùng một bảng, nhưng
 * là controller + service RIÊNG — đường khách canh bất biến "enquiry + hai
 * outbox cùng transaction", đường admin canh audit trail trạng thái.
 */
@Module({
  controllers: [EnquiriesController, AdminEnquiriesController],
  providers: [EnquiriesService, AdminEnquiriesService],
})
export class EnquiriesModule {}
