import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsEmail,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  ValidateBy,
  ValidateIf,
} from "class-validator";
import { CustomerType } from "@prisma/client";
import { isValidRut } from "@nuviora/domain";
import { ListDto, trimmed } from "../../common/list.dto";
export class CustomerDto {
  @ApiProperty({ enum: CustomerType })
  @IsEnum(CustomerType)
  type!: CustomerType;
  @ApiProperty()
  @Transform(trimmed)
  @IsString()
  @Length(2, 150, { message: "El nombre debe tener entre 2 y 150 caracteres" })
  name!: string;
  @ApiPropertyOptional()
  @Transform(trimmed)
  @IsOptional()
  @IsString()
  @ValidateBy({
    name: "rut",
    validator: {
      validate: (value: unknown) =>
        typeof value === "string" && (value === "" || isValidRut(value)),
      defaultMessage: () =>
        "El RUT debe tener formato válido y dígito verificador correcto",
    },
  })
  rut?: string;
  @ApiPropertyOptional()
  @Transform(trimmed)
  @ValidateIf((_object, value: unknown) => value !== undefined && value !== "")
  @IsEmail({}, { message: "Ingresa un correo válido" })
  @MaxLength(254)
  email?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(30)
  phone?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(250)
  address?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(100)
  commune?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(100)
  region?: string;
  @ApiPropertyOptional({ default: "Chile" })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(trimmed)
  @IsString()
  @Length(2, 100)
  country?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(5000)
  notes?: string;
}
export class UpdateCustomerDto extends PartialType(CustomerDto, {
  skipNullProperties: false,
}) {}
export class CustomerListDto extends ListDto {
  @IsIn(["ACTIVE", "ARCHIVED", "ALL"]) declare status: string;
  @ApiPropertyOptional({ enum: CustomerType })
  @IsOptional()
  @IsEnum(CustomerType)
  type?: CustomerType;
}
