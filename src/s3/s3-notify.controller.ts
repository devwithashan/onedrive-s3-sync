import {
  Body,
  Controller,
  Headers,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';

import { DashboardGateway } from '../dashboard/dashboard.gateway.js';
import { FileUploaderService } from './file-uploader.service.js';

interface S3NotifyPayload {
  bucket: string;
  key: string;
  eventTime: string;
}

@Controller('graph')
export class S3NotifyController {
  private readonly s3 = new S3Client({ region: process.env.AWS_REGION });

  constructor(
    private readonly dashboardGateway: DashboardGateway,
    private readonly fileUploaderService: FileUploaderService,
  ) {}

  @Post('s3-notify')
  async handleS3Notify(
    @Body() payload: S3NotifyPayload,
    @Headers('x-notify-secret') secret: string,
  ) {
    if (secret !== process.env.NOTIFY_SHARED_SECRET) {
      throw new UnauthorizedException();
    }

    const { Body: s3Body } = await this.s3.send(
      new GetObjectCommand({ Bucket: payload.bucket, Key: payload.key }),
    );

    const buffer = Buffer.from(await s3Body!.transformToByteArray());
    const processedData = await this.fileUploaderService.processFile(buffer);

    this.dashboardGateway.server.emit('fileProcessed', processedData);

    return { status: 'ok' };
  }
}
