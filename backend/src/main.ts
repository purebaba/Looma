import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const frontendOrigin = process.env.FRONTEND_ORIGIN || "http://localhost:3000";

  app.setGlobalPrefix("api");
  app.enableCors({
    origin: frontendOrigin.split(",").map((origin) => origin.trim()),
    credentials: true,
  });

  const port = Number(process.env.API_PORT || process.env.PORT || 4000);
  await app.listen(port);
  console.log(`Nest API listening on http://localhost:${port}/api`);
}

bootstrap();
