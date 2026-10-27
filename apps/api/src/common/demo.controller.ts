import { Controller, Get, Header } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { env } from "../config/env";
@ApiTags("demo")
@Controller("demo")
export class DemoController {
  @Get() @Header("Cache-Control", "no-store") info() {
    return {
      enabled: env.DEMO_MODE,
      email: env.DEMO_MODE ? env.DEMO_EMAIL : null,
    };
  }
}
