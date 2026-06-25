import { IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, NotEquals } from 'class-validator';

export class AdjustCreditsDto {
  @IsUUID()
  userId: string;

  @IsInt()
  @NotEquals(0)
  delta: number;

  @IsOptional()
  @IsString()
  note?: string;
}
