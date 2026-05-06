import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  @Get('health')
  health() {
    return { ok: true };
  }
}
