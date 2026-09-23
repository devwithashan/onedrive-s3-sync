import { Injectable } from '@nestjs/common';

@Injectable()
export class FileUploaderService {
  // Placeholder — replace with real parsing (e.g. xlsx → JSON) once the
  // dashboard's expected data shape is defined.
  async processFile(buffer: Buffer): Promise<{ byteLength: number }> {
    return { byteLength: buffer.length };
  }
}
