import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AccessService } from "./auth/access.service";
import { AppsController } from "./controllers/apps.controller";
import { AuthController } from "./controllers/auth.controller";
import { EntitiesController } from "./controllers/entities.controller";
import { FormsController } from "./controllers/forms.controller";
import { OrganizationsController } from "./controllers/organizations.controller";
import { TeamController } from "./controllers/team.controller";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [
    AppsController,
    AuthController,
    EntitiesController,
    FormsController,
    OrganizationsController,
    TeamController,
  ],
  providers: [AccessService],
})
export class AppModule {}
