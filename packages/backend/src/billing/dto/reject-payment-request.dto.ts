import { IsNotEmpty, IsString } from 'class-validator';

export class RejectPaymentRequestDto {
  @IsString()
  @IsNotEmpty()
  adminNote: string;
}
