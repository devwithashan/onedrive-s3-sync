import { Body, Controller, HttpStatus, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';

import { syncFileToS3 } from './graph-file-sync.js';

interface GraphNotification {
  subscriptionId: string;
  clientState: string;
  resource: string;
  changeType: string;
}

@Controller('graph')
export class GraphWebhookController {
  @Post('webhook')
  async handleWebhook(
    @Query('validationToken') validationToken: string | undefined,
    @Body() body: { value?: GraphNotification[] },
    @Res() res: Response,
  ) {
    // One-time handshake when the subscription is created — must echo
    // the token back as plain text within 10 seconds.
    if (validationToken) {
      res.status(HttpStatus.OK).type('text/plain').send(validationToken);
      return;
    }

    // Acknowledge immediately — Graph expects a fast 202.
    res.status(HttpStatus.ACCEPTED).send();

    const notifications = body?.value ?? [];

    for (const notification of notifications) {
      //just log
      console.log('OneDrive change notification received:', {
        subscriptionId: notification.subscriptionId,
        resource: notification.resource,
        changeType: notification.changeType,
      });

      if (notification.clientState !== process.env.WEBHOOK_CLIENT_STATE) {
        console.warn('Ignoring notification with mismatched clientState');
        continue;
      }

      try {
        await syncFileToS3();
      } catch (error) {
        console.error('Sync triggered by webhook failed:', error);
      }
    }
  }
}
