import {
  ApiProperty,
  ApiPropertyOptional,
  PartialType,
  PickType,
} from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  ValidateBy,
  Matches,
  ValidateIf,
} from "class-validator";
import { BusinessType, Role, SubscriptionPlan } from "@prisma/client";
import { COMMERCIAL_MODULES, isValidRut } from "@nuviora/domain";
import { OrganizationDto } from "../organizations/organization.dto";
import { trimmed, ListDto } from "../../common/list.dto";
export class CurrentOrganizationDto extends PartialType(OrganizationDto, {
  skipNullProperties: false,
}) {
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
  @ApiPropertyOptional({ enum: ["CL"] })
  @ValidateIf((_o, v: unknown) => v !== undefined)
  @IsIn(["CL"])
  country?: string;
  @ApiPropertyOptional({ enum: ["CLP"] })
  @ValidateIf((_o, v: unknown) => v !== undefined)
  @IsIn(["CLP"])
  currency?: string;
  @ApiPropertyOptional()
  @ValidateIf((_o, v: unknown) => v !== undefined)
  @IsString()
  @MaxLength(100)
  @ValidateBy({
    name: "timeZone",
    validator: {
      validate: (v: unknown) => {
        try {
          new Intl.DateTimeFormat("es", { timeZone: String(v) }).format();
          return typeof v === "string";
        } catch {
          return false;
        }
      },
    },
  })
  timeZone?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @ValidateBy({
    name: "rut",
    validator: {
      validate: (v: unknown) => typeof v === "string" && (!v || isValidRut(v)),
    },
  })
  declare rut?: string;
}
export class ModulesDto {
  @ApiProperty({ enum: BusinessType })
  @IsEnum(BusinessType)
  businessType!: BusinessType;
  @ApiProperty({ type: [String], enum: COMMERCIAL_MODULES })
  @IsArray()
  @ArrayUnique()
  @IsIn(COMMERCIAL_MODULES, { each: true })
  hiddenModules!: string[];
}
export class InviteDto {
  @ApiProperty()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email!: string;
  @ApiProperty({ enum: ["ADMIN", "MEMBER"] }) @IsIn(["ADMIN", "MEMBER"]) role!:
    "ADMIN" | "MEMBER";
}
export class MemberDto {
  @ApiPropertyOptional({ enum: ["ADMIN", "MEMBER"] })
  @ValidateIf((_o, v: unknown) => v !== undefined)
  @IsIn(["ADMIN", "MEMBER"])
  role?: Role;
  @ApiPropertyOptional()
  @ValidateIf((_o, v: unknown) => v !== undefined)
  @IsBoolean()
  active?: boolean;
}
export class AcceptInvitationDto {
  @ApiProperty() @IsString() @Matches(/^[a-f0-9]{64}$/) token!: string;
}
export class TransferDto {
  @ApiProperty() @IsUUID() memberId!: string;
  @ApiProperty() @IsString() @Length(1, 256) password!: string;
}
export class ChangePlanDto {
  @ApiProperty({ enum: SubscriptionPlan })
  @IsEnum(SubscriptionPlan)
  plan!: SubscriptionPlan;
}
export class MembersListDto extends PickType(ListDto, [
  "page",
  "pageSize",
  "search",
] as const) {}
