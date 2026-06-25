import { IsString, IsNotEmpty, IsBoolean, IsOptional } from 'class-validator';

export class UpdateOptionDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  text?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsBoolean()
  isCorrect?: boolean;
}
