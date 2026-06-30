import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class SubmitPaymentRequestDto {
  @IsEnum(['payg_topup', 'starter', 'pro', 'business'])
  requestType: 'payg_topup' | 'starter' | 'pro' | 'business';

  // multipart/form-data sends all fields as strings — coerce to integer
  @Transform(({ value }) => (value !== undefined ? parseInt(value as string, 10) : value))
  @IsInt()
  @Min(1)
  amountCents: number;

  @Transform(({ value }) => (value !== undefined ? parseInt(value as string, 10) : value))
  @IsInt()
  @Min(1)
  creditsToAdd: number;

  @IsOptional()
  @IsString()
  ownerReference?: string;
}
