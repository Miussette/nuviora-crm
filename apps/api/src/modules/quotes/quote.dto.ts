import { ApiProperty, ApiPropertyOptional, PickType } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  Equals,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateBy,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import { QuoteStatus, TaxMode } from "@prisma/client";
import {
  DISCOUNT_PATTERN,
  isDateOnly,
  MONEY_PATTERN,
  QUANTITY_PATTERN,
} from "@nuviora/domain";
import { ListDto, trimmed } from "../../common/list.dto";
const dateOnly = {
  name: "dateOnly",
  validator: {
    validate: (value: unknown) =>
      typeof value === "string" && isDateOnly(value),
  },
};
export class QuoteItemDto {
  @ApiPropertyOptional()
  @ValidateIf((_o, value: unknown) => value !== undefined)
  @IsUUID()
  catalogItemId?: string;
  @ApiProperty() @Transform(trimmed) @IsString() @Length(1, 150) name!: string;
  @ApiPropertyOptional()
  @ValidateIf((_o, value: unknown) => value !== undefined)
  @Transform(trimmed)
  @IsString()
  @MaxLength(5000)
  description?: string;
  @ApiProperty() @Transform(trimmed) @IsString() @Length(1, 50) unit!: string;
  @ApiProperty({ type: String, example: "1.0000" })
  @IsString()
  @Matches(QUANTITY_PATTERN)
  quantity!: string;
  @ApiProperty({ type: String, example: "19990.00" })
  @IsString()
  @Matches(MONEY_PATTERN)
  unitPrice!: string;
  @ApiProperty({
    type: String,
    example: "0",
    description: "Descuento porcentual por línea, 0 a 100",
  })
  @IsString()
  @Matches(DISCOUNT_PATTERN)
  discount!: string;
  @ApiProperty({ enum: TaxMode }) @IsEnum(TaxMode) taxMode!: TaxMode;
}
export class QuoteContentDto {
  @ApiProperty() @IsUUID() customerId!: string;
  @ApiProperty({ example: "2026-10-27" })
  @ValidateBy(dateOnly)
  issueDate!: string;
  @ApiProperty({ example: "2026-11-27" })
  @ValidateBy(dateOnly)
  expiryDate!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(150)
  reference?: string;
  @ApiProperty({ type: [QuoteItemDto] })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => QuoteItemDto)
  items!: QuoteItemDto[];
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(5000)
  notes?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(2000)
  deliveryTerms?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(2000)
  paymentTerms?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(1000)
  validityTerms?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(5000)
  customerNotes?: string;
}
export class CreateQuoteDto extends QuoteContentDto {
  @ApiProperty({
    description:
      "UUID estable por intento de creación, reutilizar en reintentos",
  })
  @IsUUID()
  requestKey!: string;
}
export class UpdateQuoteDto extends QuoteContentDto {
  @ApiProperty({
    description:
      "Versión leída antes de editar; el servidor rechaza actualizaciones obsoletas",
  })
  @IsInt()
  @Min(1)
  documentVersion!: number;
}
export class VersionDto {
  @ApiProperty() @IsInt() @Min(1) documentVersion!: number;
}
export class DuplicateQuoteDto {
  @ApiProperty() @IsUUID() requestKey!: string;
}
export class ShareQuoteDto {
  @ApiProperty({ default: 7, minimum: 1, maximum: 90 })
  @IsInt()
  @Min(1)
  @Max(90)
  expiresInDays!: number;
}
export class QuoteDecisionDto extends VersionDto {
  @ApiProperty({ enum: [true] }) @Equals(true) confirmed!: boolean;
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(120)
  approverName?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
export class FollowUpDto {
  @ApiProperty() @Transform(trimmed) @IsString() @Length(1, 1000) note!: string;
}
export class QuoteListDto extends PickType(ListDto, [
  "page",
  "pageSize",
  "search",
] as const) {
  @ApiPropertyOptional({ enum: QuoteStatus })
  @IsOptional()
  @IsEnum(QuoteStatus)
  status?: QuoteStatus;
  @ApiPropertyOptional() @IsOptional() @IsUUID() customerId?: string;
  @ApiPropertyOptional() @IsOptional() @ValidateBy(dateOnly) from?: string;
  @ApiPropertyOptional() @IsOptional() @ValidateBy(dateOnly) to?: string;
}
export const DOCUMENT_COLORS = ["#7759A6", "#292633", "#356447", "#805B1C"];
export class QuoteBrandingDto {
  @ApiPropertyOptional({
    description: "PNG/JPEG base64 de hasta 256 KB; vacío elimina el logo",
  })
  @ValidateIf((_o, value: unknown) => value !== undefined)
  @IsString()
  @MaxLength(360000)
  logoDataUrl?: string;
  @ApiProperty({ enum: DOCUMENT_COLORS })
  @IsIn(DOCUMENT_COLORS)
  accentColor!: string;
  @ApiProperty()
  @Transform(trimmed)
  @IsString()
  @MaxLength(250)
  footer!: string;
}
