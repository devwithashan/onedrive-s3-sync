import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Server } from 'socket.io';

@WebSocketGateway({ cors: true })
export class DashboardGateway {
  @WebSocketServer()
  server!: Server;
}
