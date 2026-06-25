import { IsInt, Min } from 'class-validator';

export class ReorderQuestionDto {
  @IsInt()
  @Min(0)
  order: number;
}
