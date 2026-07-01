import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString, Length } from 'class-validator';
import { REGIONAL_ROUTES } from '../../riot/riot.service';

export class CreateAccountDto {
  // Riot game names are 3-16 characters.
  @ApiProperty({ example: 'TestName' })
  @IsString()
  @IsNotEmpty()
  @Length(3, 16)
  gameName: string;

  // Tag lines are 3-5 characters (without the leading '#').
  @ApiProperty({ example: 'NA1' })
  @IsString()
  @IsNotEmpty()
  @Length(2, 5)
  tagLine: string;

  // Regional routing value (americas | europe | asia | sea).
  @ApiProperty({ example: 'americas', enum: REGIONAL_ROUTES })
  @IsString()
  @IsIn(REGIONAL_ROUTES as readonly string[])
  region: string;
}
