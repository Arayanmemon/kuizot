import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Param,
  Body,
  Query,
  Request,
  UseGuards,
  UseInterceptors,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminService } from './admin.service';
import { AuditLogInterceptor } from './interceptors/audit-log.interceptor';
import { UpdateUserDto } from './dto/update-user.dto';
import { ListQueryDto, PaginationQueryDto } from './dto/list-query.dto';
import { PaymentRequestsService } from '../billing/payment-requests/payment-requests.service';
import { CreditsService } from '../billing/credits/credits.service';
import type { PaymentRequestStatus } from '../entities/payment-request.entity';
import { RejectPaymentRequestDto } from '../billing/dto/reject-payment-request.dto';
import { AdjustCreditsDto } from '../billing/dto/adjust-credits.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin', 'admin')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly paymentRequestsService: PaymentRequestsService,
    private readonly creditsService: CreditsService,
  ) {}

  // GET /admin/users?page&limit&search&sortBy&sortOrder
  @Get('users')
  getUsers(@Query() query: ListQueryDto) {
    return this.adminService.getUsers(
      query.page,
      query.limit,
      query.search,
      query.sortBy,
      query.sortOrder,
    );
  }

  // PATCH /admin/users/:id
  @Patch('users/:id')
  @UseInterceptors(AuditLogInterceptor)
  updateUser(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.adminService.updateUser(id, dto);
  }

  // DELETE /admin/users/:id
  @Delete('users/:id')
  @UseInterceptors(AuditLogInterceptor)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteUser(@Param('id') id: string) {
    return this.adminService.deleteUser(id);
  }

  // GET /admin/quizzes?page&limit&search&sortBy&sortOrder
  @Get('quizzes')
  getQuizzes(@Query() query: ListQueryDto) {
    return this.adminService.getQuizzes(
      query.page,
      query.limit,
      query.search,
      query.sortBy,
      query.sortOrder,
    );
  }

  // DELETE /admin/quizzes/:id
  @Delete('quizzes/:id')
  @UseInterceptors(AuditLogInterceptor)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteQuiz(@Param('id') id: string) {
    return this.adminService.deleteQuiz(id);
  }

  // GET /admin/stats
  @Get('stats')
  getStats() {
    return this.adminService.getStats();
  }

  // GET /admin/audit-log?page&limit
  @Get('audit-log')
  getAuditLog(@Query() query: PaginationQueryDto) {
    return this.adminService.getAuditLog(query.page, query.limit);
  }

  // GET /admin/billing/payment-requests?status=pending
  @Get('billing/payment-requests')
  listAllPaymentRequests(@Query('status') status?: PaymentRequestStatus) {
    return this.paymentRequestsService.listAll(status);
  }

  // PATCH /admin/billing/payment-requests/:id/confirm
  @Patch('billing/payment-requests/:id/confirm')
  @UseInterceptors(AuditLogInterceptor)
  confirmPaymentRequest(@Param('id') id: string, @Request() req: { user: { sub: string } }) {
    return this.paymentRequestsService.confirm(id, req.user.sub);
  }

  // PATCH /admin/billing/payment-requests/:id/reject
  @Patch('billing/payment-requests/:id/reject')
  @UseInterceptors(AuditLogInterceptor)
  rejectPaymentRequest(
    @Param('id') id: string,
    @Body() dto: RejectPaymentRequestDto,
    @Request() req: { user: { sub: string } },
  ) {
    return this.paymentRequestsService.reject(id, req.user.sub, dto.adminNote);
  }

  // POST /admin/billing/credits/adjust — super_admin only
  @Post('billing/credits/adjust')
  @Roles('super_admin')
  adjustCredits(@Body() dto: AdjustCreditsDto, @Request() req: { user: { sub: string } }) {
    if (dto.delta > 0) {
      return this.creditsService.addCredits(
        dto.userId,
        dto.delta,
        'admin_adjustment',
        undefined,
      );
    } else {
      return this.creditsService.deductCredits(
        dto.userId,
        Math.abs(dto.delta),
        'admin_adjustment',
        undefined,
      );
    }
  }
}
