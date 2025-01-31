import { Module } from '@nestjs/common';
import { DatabaseAuditController } from './database-audit.controller';
import { DatabaseAuditService } from './database-audit.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Anomaly } from './entities/anomaly.entity';
import { AnomalyCollector } from 'src/audit/anomaly.collector';
import { ReportGenerator } from 'src/audit/report.generator';

@Module({
  imports: [TypeOrmModule.forFeature([Anomaly])],
  controllers: [DatabaseAuditController],
  providers: [DatabaseAuditService, AnomalyCollector, ReportGenerator],
})
export class DatabaseAuditModule {}