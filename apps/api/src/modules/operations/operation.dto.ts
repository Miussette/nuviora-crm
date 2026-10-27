import { ApiProperty, ApiPropertyOptional, PickType } from "@nestjs/swagger";
import { Type, Transform } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
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
  MaxLength,
  Min,
  ValidateBy,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import { OperationStatus, OperationType, PaymentMethod } from "@prisma/client";
import { isDateOnly, MONEY_PATTERN } from "@nuviora/domain";
import { ListDto, trimmed } from "../../common/list.dto";
import { QuoteItemDto } from "../quotes/quote.dto";
const date = {
  name: "dateOnly",
  validator: {
    validate: (v: unknown) => typeof v === "string" && isDateOnly(v),
  },
};
export class OperationInfoDto {
  @ApiProperty({ enum: OperationType })
  @IsEnum(OperationType)
  type!: OperationType;
  @ApiProperty() @ValidateBy(date) issueDate!: string;
  @ApiPropertyOptional()
  @ValidateIf((_o, v: unknown) => v !== undefined && v !== null)
  @ValidateBy(date)
  dueDate?: string | null;
  @ApiPropertyOptional()
  @ValidateIf((_o, v: unknown) => v !== undefined && v !== null)
  @IsUUID()
  assignedUserId?: string | null;
  @ApiProperty()
  @Transform(trimmed)
  @IsString()
  @Length(1, 5000)
  description!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(5000)
  instructions?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(5000)
  internalNotes?: string;
}
export class CreateOperationDto extends OperationInfoDto {
  @ApiProperty() @IsUUID() requestKey!: string;
  @ApiProperty() @IsUUID() customerId!: string;
  @ApiProperty({ enum: ["PENDING", "IN_PROGRESS"] })
  @IsIn(["PENDING", "IN_PROGRESS"])
  status!: "PENDING" | "IN_PROGRESS";
  @ApiProperty({ type: [QuoteItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => QuoteItemDto)
  items!: QuoteItemDto[];
}
export class ConvertOperationDto extends OperationInfoDto {}
export class UpdateOperationDto extends PickType(OperationInfoDto, [
  "dueDate",
  "assignedUserId",
  "description",
  "instructions",
  "internalNotes",
] as const) {
  @ApiProperty() @IsInt() @Min(1) version!: number;
}
export class OperationStatusDto {
  @ApiProperty({ enum: OperationStatus })
  @IsEnum(OperationStatus)
  status!: OperationStatus;
  @ApiProperty() @IsInt() @Min(1) version!: number;
}
export class OperationListDto extends PickType(ListDto, [
  "page",
  "pageSize",
  "search",
] as const) {
  @ApiPropertyOptional({ enum: OperationStatus })
  @IsOptional()
  @IsEnum(OperationStatus)
  status?: OperationStatus;
  @ApiPropertyOptional({ enum: OperationType })
  @IsOptional()
  @IsEnum(OperationType)
  type?: OperationType;
  @ApiPropertyOptional() @IsOptional() @IsUUID() customerId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() operationId?: string;
  @ApiPropertyOptional({ enum: ["PENDING", "PARTIAL", "PAID"] })
  @IsOptional()
  @IsIn(["PENDING", "PARTIAL", "PAID"])
  paymentStatus?: string;
  @ApiPropertyOptional() @IsOptional() @ValidateBy(date) from?: string;
  @ApiPropertyOptional() @IsOptional() @ValidateBy(date) to?: string;
}
export class CreatePaymentDto {
  @ApiProperty() @IsUUID() operationId!: string;
  @ApiProperty() @IsUUID() requestKey!: string;
  @ApiProperty({ type: String })
  @IsString()
  @Matches(MONEY_PATTERN)
  amount!: string;
  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;
  @ApiProperty() @ValidateBy(date) paidAt!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(150)
  reference?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
export class ReversePaymentDto {
  @ApiProperty({ enum: [true] }) @Equals(true) confirmed!: boolean;
  @ApiProperty()
  @Transform(trimmed)
  @IsString()
  @Length(3, 1000)
  reason!: string;
}
