import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type, Transform } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";
export class ListDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  page = 1;
  @ApiPropertyOptional({ default: 10, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 10;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  search?: string;
  @ApiPropertyOptional({ enum: ["ACTIVE", "INACTIVE", "ARCHIVED", "ALL"] })
  @IsOptional()
  @IsIn(["ACTIVE", "INACTIVE", "ARCHIVED", "ALL"])
  status: string = "ACTIVE";
  @ApiPropertyOptional({ enum: ["name", "createdAt"] })
  @IsOptional()
  @IsIn(["name", "createdAt"])
  sortBy: "name" | "createdAt" = "name";
  @ApiPropertyOptional({ enum: ["asc", "desc"] })
  @IsOptional()
  @IsIn(["asc", "desc"])
  sortOrder: "asc" | "desc" = "asc";
}
export const trimmed = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;
export const nullable = (value?: string | null) => value?.trim() || null;
