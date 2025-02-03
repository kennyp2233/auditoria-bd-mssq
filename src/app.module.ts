import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseAuditModule } from './database-audit/database-audit.module';

@Module({
    imports: [
        ConfigModule.forRoot(),
        TypeOrmModule.forRoot({
            type: 'mssql',
            host: process.env.DB_SERVER || 'localhost',
            username: process.env.DB_USER || 'sa',
            password: process.env.DB_PASSWORD || 'Passw0rd!',
            database: 'AnomalyDB1',
            entities: [__dirname + '/**/*.entity{.ts,.js}'],
            synchronize: true,
            extra: {
                options: {
                    encrypt: true,
                    trustServerCertificate: true,
                    enableArithAbort: true
                }
            }
        }),
        DatabaseAuditModule,
    ],
})
export class AppModule { }