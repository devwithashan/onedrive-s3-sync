import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { GraphWebhookController } from './onedrive/graph-webhook.controller.js';
import { S3NotifyController } from './s3/s3-notify.controller.js';
import { FileUploaderService } from './s3/file-uploader.service.js';
import { DashboardGateway } from './dashboard/dashboard.gateway.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  controllers: [AppController, GraphWebhookController, S3NotifyController],
  providers: [AppService, FileUploaderService, DashboardGateway],
})
export class AppModule {}
