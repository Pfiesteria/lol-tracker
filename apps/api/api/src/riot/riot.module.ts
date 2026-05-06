import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { RiotService } from './riot.service';

@Module({
  imports: [HttpModule],
  providers: [RiotService],
  exports: [RiotService],
})
export class RiotModule {}
