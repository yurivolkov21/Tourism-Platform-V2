import { Controller } from '@nestjs/common';
import { Implement, implement } from '@orpc/nest';
import { contract } from '@tourism/contract';
import { Roles } from '../../auth/roles.decorator.js';
import { UserRole } from '../../generated/prisma/enums.js';
import {
  AdminDeparturesService,
  DepartureNotFoundError,
  DepartureRuleError,
} from './admin-departures.service.js';

/**
 * Bề mặt chuyến khởi hành cho admin (spec P4e-1 F12). Cùng cách ghép guard
 * như `AdminEnquiriesController`: `@Roles(ADMIN)` ở cấp class được AuthGuard
 * đọc — ẩn danh → 401, không phải admin → 403, cả hai TRƯỚC khi oRPC parse
 * input, nên một request không quyền không bao giờ chạm tới bảng.
 *
 * Ba lệnh ghi không nhận danh tính admin qua input và cũng chưa ghi audit
 * row: chuyến không có sổ lịch sử riêng (khác enquiry), còn thứ đổi tiền thì
 * nằm ở đường huỷ của F13. Dấu vết hiện tại là dòng log của service.
 */
@Controller()
@Roles(UserRole.ADMIN)
export class AdminDeparturesController {
  constructor(private readonly departures: AdminDeparturesService) {}

  @Implement(contract.admin.departures.list)
  list() {
    return implement(contract.admin.departures.list).handler(async ({ input, errors }) => {
      try {
        return await this.departures.list(input);
      } catch (error) {
        throw mapError(error, errors);
      }
    });
  }

  @Implement(contract.admin.departures.create)
  create() {
    return implement(contract.admin.departures.create).handler(async ({ input, errors }) => {
      try {
        return await this.departures.create(input);
      } catch (error) {
        throw mapError(error, errors);
      }
    });
  }

  @Implement(contract.admin.departures.update)
  update() {
    return implement(contract.admin.departures.update).handler(async ({ input, errors }) => {
      try {
        return await this.departures.update(input);
      } catch (error) {
        throw mapError(error, errors);
      }
    });
  }

  @Implement(contract.admin.departures.setStatus)
  setStatus() {
    return implement(contract.admin.departures.setStatus).handler(async ({ input, errors }) => {
      try {
        return await this.departures.setStatus(input);
      } catch (error) {
        throw mapError(error, errors);
      }
    });
  }
}

/**
 * Lỗi của service → lỗi contract, giữ nguyên câu đã mang con số thật.
 *
 * `errors` khai theo TỪNG procedure nên kiểu của nó hẹp hơn tập mã chung —
 * mỗi handler chỉ gọi hàm này với đúng những mã procedure ấy khai, và một mã
 * lọt sang procedure không khai nó sẽ rơi về `throw error` (500 nhìn thấy
 * được) thay vì biến thành một lỗi im lặng sai loại.
 */
function mapError(error: unknown, errors: Record<string, (init?: { message: string }) => Error>) {
  if (error instanceof DepartureNotFoundError) {
    const notFound = errors.NOT_FOUND;
    if (notFound) return notFound();
  }
  // `TourNotFoundError` đi cùng đường: `NOT_FOUND` của `list`/`create` nói về
  // tour, của `update`/`setStatus` nói về chuyến — mỗi procedure một câu, khai
  // ngay trong contract.
  if (error instanceof Error && error.name === 'TourNotFoundError') {
    const notFound = errors.NOT_FOUND;
    if (notFound) return notFound();
  }
  if (error instanceof DepartureRuleError) {
    const rejected = errors[error.code];
    if (rejected) return rejected({ message: error.message });
  }
  return error;
}
