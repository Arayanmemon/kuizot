import { IsString, IsNotEmpty, IsInt, IsOptional, Min, Max, IsIn } from 'class-validator';

export class CreateQuestionDto {
  @IsString()
  @IsNotEmpty()
  text: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(120)
  timeLimit?: number;

  @IsOptional()
  @IsIn(['classic', 'accuracy'])
  scoringMode?: 'classic' | 'accuracy';

  @IsInt()
  @Min(0)
  order: number;
}
