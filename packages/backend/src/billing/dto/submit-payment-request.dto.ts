import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class SubmitPaymentRequestDto {
  @IsEnum(['payg_topup', 'starter', 'pro', 'business'])
  requestType: 'payg_topup' | 'starter' | 'pro' | 'business';

  @IsInt()
  @Min(1)
  amountCents: number;

  @IsInt()
  @Min(1)
  creditsToAdd: number;

  @IsOptional()
  @IsString()
  ownerReference?: string;
}
