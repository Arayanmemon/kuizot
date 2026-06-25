import { IsEnum, IsOptional, IsBoolean } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsEnum(['super_admin', 'admin', 'owner'])
  role?: 'super_admin' | 'admin' | 'owner';

  @IsOptional()
  @IsBoolean()
  suspended?: boolean;
}
