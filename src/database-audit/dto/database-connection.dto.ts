import { IsString, IsNumber } from 'class-validator';

export class DatabaseConnectionDto {
  @IsString()
  host: string;

  @IsNumber()
  port: number;

  @IsString()
  username: string;

  @IsString()
  password: string;

  @IsString()
  database: string;
}
