import { IsString, IsNotEmpty, IsInt, IsOptional, Min, Max, IsIn, IsUrl } from 'class-validator';

export class UpdateQuestionDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  text?: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(120)
  timeLimit?: number;

  @IsOptional()
  @IsIn(['classic', 'accuracy'])
  scoringMode?: 'classic' | 'accuracy';

  @IsOptional()
  @IsString()
  imageUrl?: string;
}
