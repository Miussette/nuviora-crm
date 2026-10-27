import { IsEmail, IsEnum, IsOptional, IsString, Length, Matches } from 'class-validator';
import { BusinessType } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
export class OrganizationDto {
  @ApiProperty({ minLength: 2, maxLength: 100 }) @IsString() @Length(2, 100) @Matches(/\S/, { message: 'El nombre no puede estar vacío' }) name!: string;
  @ApiProperty({ format: 'email' }) @IsEmail() @Length(3, 254) email!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0, 150) legalName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0, 20) rut?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0, 30) phone?: string;
  @ApiProperty({ enum: BusinessType }) @IsEnum(BusinessType) businessType!: BusinessType;
}
