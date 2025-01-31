import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Anomaly } from 'src/database-audit/entities/anomaly.entity';
@Injectable()
export class AnomalyCollector {
    constructor(
        @InjectRepository(Anomaly)
        private anomalyRepository: Repository<Anomaly>,
    ) { }

    async addAnomaly(anomalyData: {
        type: string;
        description: string;
        affectedTable: string;
        affectedData?: string;
    }): Promise<void> {
        const anomaly = this.anomalyRepository.create(anomalyData);
        await this.anomalyRepository.save(anomaly);
    }

    async getAnomalies(): Promise<Anomaly[]> {
        return this.anomalyRepository.find();
    }

    async clear(): Promise<void> {
        await this.anomalyRepository.delete({});
    }
}