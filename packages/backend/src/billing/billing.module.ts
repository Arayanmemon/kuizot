import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Subscription } from '../entities/subscription.entity';
import { PaymentRequest } from '../entities/payment-request.entity';
import { CreditTransaction } from '../entities/credit-transaction.entity';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { CreditsService } from './credits/credits.service';
import { PaymentRequestsService } from './payment-requests/payment-requests.service';
import { BillingCronService } from './billing-cron.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Subscription, PaymentRequest, CreditTransaction]),
  ],
  controllers: [BillingController],
  providers: [BillingService, CreditsService, PaymentRequestsService, BillingCronService],
  exports: [BillingService, CreditsService, PaymentRequestsService],
})
export class BillingModule {}
