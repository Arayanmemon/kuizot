import {
  Controller,
  Get,
  Post,
  Body,
  Request,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as fs from 'fs';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ConfigService } from '@nestjs/config';
import { BillingService } from './billing.service';
import { PaymentRequestsService } from './payment-requests/payment-requests.service';
import { CreditsService } from './credits/credits.service';
import { SubmitPaymentRequestDto } from './dto/submit-payment-request.dto';

@UseGuards(JwtAuthGuard)
@Controller('billing')
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly paymentRequestsService: PaymentRequestsService,
    private readonly creditsService: CreditsService,
    private readonly configService: ConfigService,
  ) {}

  // GET /billing/me — return subscription status
  @Get('me')
  async getMe(@Request() req: { user: { sub: string } }) {
    return this.billingService.getSubscription(req.user.sub);
  }

  // GET /billing/bank-details — return bank info from env (keeps secrets server-side)
  @Get('bank-details')
  getBankDetails() {
    return {
      accountName: this.configService.get('BANK_ACCOUNT_NAME'),
      accountNumber: this.configService.get('BANK_ACCOUNT_NUMBER'),
      sortCode: this.configService.get('BANK_SORT_CODE'),
      iban: this.configService.get('BANK_IBAN'),
      referencePrefix: this.configService.get('BANK_REFERENCE_PREFIX', 'KZT'),
    };
  }

  // POST /billing/payment-requests — submit payment request with optional proof file
  @Post('payment-requests')
  @UseInterceptors(
    FileInterceptor('proof', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadPath = process.env.UPLOAD_LOCAL_PATH ?? './uploads';
          fs.mkdirSync(uploadPath, { recursive: true });
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          cb(null, `${Date.now()}-${file.originalname}`);
        },
      }),
    }),
  )
  async submitPaymentRequest(
    @Request() req: { user: { sub: string } },
    @Body() dto: SubmitPaymentRequestDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const proofFileUrl = file ? file.path : null;
    return this.paymentRequestsService.submit(req.user.sub, dto, proofFileUrl);
  }

  // GET /billing/payment-requests — list own requests
  @Get('payment-requests')
  listPaymentRequests(@Request() req: { user: { sub: string } }) {
    return this.paymentRequestsService.listByOwner(req.user.sub);
  }

  // GET /billing/transactions — list own credit transactions
  @Get('transactions')
  async listTransactions(@Request() req: { user: { sub: string } }) {
    return this.creditsService.getTransactions(req.user.sub);
  }
}
