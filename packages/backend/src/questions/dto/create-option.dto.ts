import { IsString, IsNotEmpty, IsBoolean, IsOptional } from 'class-validator';

export class CreateOptionDto {
  @IsString()
  @IsNotEmpty()
  text: string;

  @IsString()
  color: string;

  @IsOptional()
  @IsBoolean()
  isCorrect?: boolean;
}
