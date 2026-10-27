import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from "class-validator";
import { CatalogType, TaxMode } from "@prisma/client";
import { MONEY_PATTERN } from "@nuviora/domain";
import { ListDto, trimmed } from "../../common/list.dto";
export class CatalogDto {
  @ApiProperty({ enum: CatalogType }) @IsEnum(CatalogType) type!: CatalogType;
  @ApiProperty()
  @Transform(trimmed)
  @IsString()
  @Length(2, 150, { message: "El nombre debe tener entre 2 y 150 caracteres" })
  name!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @MaxLength(60)
  sku?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(5000)
  description?: string;
  @ApiProperty({
    type: String,
    example: "19990.00",
    description: "Decimal exacto, no negativo, hasta 16 enteros y 2 decimales",
  })
  @IsString()
  @Matches(MONEY_PATTERN, {
    message:
      "El precio debe ser un texto decimal no negativo, con hasta 16 enteros y 2 decimales",
  })
  unitPrice!: string;
  @ApiProperty()
  @Transform(trimmed)
  @IsString()
  @Length(1, 50, { message: "Ingresa la unidad de medida" })
  unit!: string;
  @ApiProperty({ enum: TaxMode }) @IsEnum(TaxMode) taxMode!: TaxMode;
  @ApiProperty({ default: true }) @IsBoolean() active!: boolean;
}
export class UpdateCatalogDto extends PartialType(CatalogDto, {
  skipNullProperties: false,
}) {}
export class CatalogListDto extends ListDto {
  @ApiPropertyOptional({ enum: CatalogType })
  @IsOptional()
  @IsEnum(CatalogType)
  type?: CatalogType;
}
