import { Controller, Get, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerModule } from "@nestjs/throttler";
import {SessionThrottlerGuard} from './common/session-throttler.guard';
import { LoggerModule } from "nestjs-pino";
import { PrismaService } from "./database/prisma.service";
import {DemoController} from './common/demo.controller';
import { AuthGuard } from "./common/auth.guard";
import { AuthController } from "./modules/auth/auth.controller";
import { AuthService } from "./modules/auth/auth.service";
import { OrganizationsController } from "./modules/organizations/organizations.controller";
import { OrganizationsService } from "./modules/organizations/organizations.service";
import { TenantService } from "./common/tenant";
import { CustomersController } from "./modules/customers/customers.controller";
import { CustomersService } from "./modules/customers/customers.service";
import { CatalogController } from "./modules/catalog/catalog.controller";
import { CatalogService } from "./modules/catalog/catalog.service";
import {
  QuotesController,
  PublicQuotesController,
  QuoteBrandingController,
} from "./modules/quotes/quotes.controller";
import { QuoteStore } from "./modules/quotes/quote.store";
import { QuotesService } from "./modules/quotes/quotes.service";
import { QuoteWriterService } from "./modules/quotes/quote-writer.service";
import { QuoteWorkflowService } from "./modules/quotes/quote-workflow.service";
import { QuoteBrandingService } from "./modules/quotes/quote-branding.service";
import { QuotePdfService } from "./modules/quotes/quote-pdf.service";
import { OperationsService } from './modules/operations/operations.service';
import {AdminService} from './modules/administration/admin.service';
import {PlanService} from './modules/administration/plan.service';
import {CurrentOrganizationController,InvitationsController,SubscriptionsController} from './modules/administration/admin.controller';
import {AnalyticsService} from './modules/analytics/analytics.service';
import {DashboardController,ReportsController} from './modules/analytics/analytics.controller';
import { OperationsController, PaymentsController, QuoteConversionController, ReceivablesController } from './modules/operations/operations.controller';
@Controller("health")
class HealthController {
  constructor(private readonly db: PrismaService) {}
  @Get() async health() {
    await this.db.$queryRaw`SELECT 1`;
    return { status: "ok" };
  }
}
@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        serializers: {
          req: (req: { id: string; method: string; url: string }) => ({
            id: req.id,
            method: req.method,
            url: req.url
              .split("?")[0]
              ?.replace(/(\/public\/quotes\/)[^/]+/, "$1[redacted]"),
          }),
        },
        redact: [
          "req.headers.cookie",
          "req.headers.authorization",
          'res.headers["set-cookie"]',
        ],
        autoLogging: true,
      },
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 30 }]),
  ],
  controllers: [
    DemoController,
    CurrentOrganizationController, InvitationsController, SubscriptionsController, DashboardController, ReportsController,
    OperationsController, PaymentsController, QuoteConversionController, ReceivablesController,
    HealthController,
    AuthController,
    OrganizationsController,
    CustomersController,
    CatalogController,
    QuotesController,
    PublicQuotesController,
    QuoteBrandingController,
  ],
  providers: [
    AdminService, PlanService, AnalyticsService,
    OperationsService,
    PrismaService,
    AuthGuard,
    AuthService,
    OrganizationsService,
    TenantService,
    CustomersService,
    CatalogService,
    QuoteStore,
    QuotesService,
    QuoteWriterService,
    QuoteWorkflowService,
    QuoteBrandingService,
    QuotePdfService,
    { provide: APP_GUARD, useClass: SessionThrottlerGuard },
  ],
})
export class AppModule {}
