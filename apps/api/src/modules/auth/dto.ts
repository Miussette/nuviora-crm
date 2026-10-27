import { Equals, IsEmail, IsString, Length, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
export class EmailDto {
  @ApiProperty({ example: 'persona@example.cl', format: 'email' }) @IsEmail() @Length(3, 254) email!: string;
}
export class LoginDto extends EmailDto {
  @ApiProperty({ format: 'password', maxLength: 128 }) @IsString() @Length(1, 128) password!: string;
}
export class RegisterDto extends EmailDto {
  @ApiProperty({ minLength: 2, maxLength: 100 }) @IsString() @Length(2, 100) @Matches(/\S/, { message: 'El nombre no puede estar vacío' }) name!: string;
  @ApiProperty({ format: 'password', minLength: 12, maxLength: 128 }) @IsString() @Length(12, 128) password!: string;
  @ApiProperty({ enum: [true] }) @Equals(true, { message: 'Debes aceptar los términos' }) terms!: boolean;
}
export class TokenDto {
  @ApiProperty({ pattern: '^[a-f0-9]{64}$', description: 'Token de un solo uso recibido por correo' }) @IsString() @Matches(/^[a-f0-9]{64}$/) token!: string;
}
export class ResetDto extends TokenDto {
  @ApiProperty({ format: 'password', minLength: 12, maxLength: 128 }) @IsString() @Length(12, 128) password!: string;
}
