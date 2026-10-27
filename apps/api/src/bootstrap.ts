import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { BadRequestException, ValidationPipe } from "@nestjs/common";
import { validationMessages } from "./common/validation";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { Logger } from "nestjs-pino";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { Request, Response, NextFunction, json } from "express";
import { env } from "./config/env";
import { AppModule } from "./app.module";
export async function createApp() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    bodyParser: false,
  });
  app.useLogger(app.get(Logger));
  app.use(helmet());
  app.use(json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith("/api/v1/public/quotes/")) {
      res.set({
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow, noarchive",
        "Referrer-Policy": "no-referrer",
      });
    }
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.headers.origin !== env.APP_ORIGIN
    ) {
      res.status(403).json({ message: "Origen de solicitud no permitido" });
      return;
    }
    next();
  });
  app.enableCors({ origin: env.APP_ORIGIN, credentials: true });
  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) =>
        new BadRequestException(validationMessages(errors)),
    }),
  );
  SwaggerModule.setup(
    "api/docs",
    app,
    SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle("Nuviora Gestión")
        .setVersion("1.0")
        .addCookieAuth("nuviora_session")
        .build(),
    ),
  );
  app.enableShutdownHooks();
  return app;
}
