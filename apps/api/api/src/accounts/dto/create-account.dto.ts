import { ApiProperty } from '@nestjs/swagger';

export class CreateAccountDto {
  @ApiProperty({ example: 'TestName' })
  gameName: string;

  @ApiProperty({ example: 'NA1' })
  tagLine: string;

  @ApiProperty({ example: 'americas' })
  region: string;
}
