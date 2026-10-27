import { ApiPropertyOptional, PickType } from "@nestjs/swagger";
import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  ValidateBy,
  MaxLength,
} from "class-validator";
import { PERIODS, isDateOnly } from "@nuviora/domain";
import { ListDto } from "../../common/list.dto";
export class AnalyticsDto extends PickType(ListDto, [
  "page",
  "pageSize",
  "search",
] as const) {
  @ApiPropertyOptional({ enum: PERIODS, default: "THIS_MONTH" })
  @IsIn(PERIODS)
  preset: string = "THIS_MONTH";
  @ApiPropertyOptional()
  @IsOptional()
  @ValidateBy({
    name: "dateOnly",
    validator: {
      validate: (v: unknown) => typeof v === "string" && isDateOnly(v),
    },
  })
  from?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @ValidateBy({
    name: "dateOnly",
    validator: {
      validate: (v: unknown) => typeof v === "string" && isDateOnly(v),
    },
  })
  to?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() customerId?: string;
  @ApiPropertyOptional({ enum: ["ORDER", "WORK"] })
  @IsOptional()
  @IsIn(["ORDER", "WORK"])
  type?: "ORDER" | "WORK";
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  status?: string;
  @ApiPropertyOptional({ enum: ["sales", "quotes", "operations", "payments"] })
  @IsOptional()
  @IsIn(["sales", "quotes", "operations", "payments"])
  report?: "sales" | "quotes" | "operations" | "payments";
}
