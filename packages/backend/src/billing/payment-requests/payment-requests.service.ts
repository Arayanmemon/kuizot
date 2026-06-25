import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentRequest, PaymentRequestStatus } from '../../entities/payment-request.entity';
import { Subscription } from '../../entities/subscription.entity';
import { CreditsService } from '../credits/credits.service';
import { SubmitPaymentRequestDto } from '../dto/submit-payment-request.dto';

@Injectable()
export class PaymentRequestsService {
  constructor(
    @InjectRepository(PaymentRequest)
    private prRepo: Repository<PaymentRequest>,
    @InjectRepository(Subscription)
    private subRepo: Repository<Subscription>,
    private readonly creditsService: CreditsService,
  ) {}

  async submit(
    userId: string,
    dto: SubmitPaymentRequestDto,
    proofFileUrl: string | null,
  ): Promise<PaymentRequest> {
    const pr = this.prRepo.create({
      user: { id: userId } as any,
      requestType: dto.requestType,
      amountCents: dto.amountCents,
      creditsToAdd: dto.creditsToAdd,
      ownerReference: dto.ownerReference ?? null,
      proofFileUrl,
      status: 'pending',
    });
    return this.prRepo.save(pr);
  }

  async listByOwner(userId: string): Promise<PaymentRequest[]> {
    return this.prRepo.find({
      where: { user: { id: userId } },
      order: { submittedAt: 'DESC' },
    });
  }

  async listAll(status?: PaymentRequestStatus): Promise<PaymentRequest[]> {
    const where = status ? { status } : {};
    return this.prRepo.find({
      where,
      relations: ['user', 'reviewedBy'],
      order: { submittedAt: 'DESC' },
    });
  }

  async confirm(id: string, actorId: string): Promise<PaymentRequest> {
    const pr = await this.prRepo.findOne({ where: { id }, relations: ['user'] });
    if (!pr) throw new NotFoundException('Payment request not found');
    if (pr.status !== 'pending')
      throw new BadRequestException('Request already processed');

    pr.status = 'confirmed';
    pr.reviewedAt = new Date();
    pr.reviewedBy = { id: actorId } as any;
    await this.prRepo.save(pr);

    // Add credits to the owner's account
    await this.creditsService.addCredits(pr.user.id, pr.creditsToAdd, 'payment', pr.id);

    // If requestType is a tier, upgrade subscription
    if (['starter', 'pro', 'business'].includes(pr.requestType)) {
      await this.subRepo.update(
        { user: { id: pr.user.id } },
        {
          tier: pr.requestType as any,
          billingModel: 'monthly',
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      );
    }

    return pr;
  }

  async reject(
    id: string,
    actorId: string,
    adminNote: string,
  ): Promise<PaymentRequest> {
    const pr = await this.prRepo.findOne({ where: { id } });
    if (!pr) throw new NotFoundException('Payment request not found');
    if (pr.status !== 'pending')
      throw new BadRequestException('Request already processed');

    pr.status = 'rejected';
    pr.reviewedAt = new Date();
    pr.reviewedBy = { id: actorId } as any;
    pr.adminNote = adminNote;
    return this.prRepo.save(pr);
  }
}
