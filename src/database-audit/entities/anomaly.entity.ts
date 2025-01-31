import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Anomaly {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    type: string;

    @Column()
    description: string;

    @Column({ name: 'affected_table' }) // Opcional: si quieres nombre de columna snake_case
    affectedTable: string;

    @Column('text', { name: 'affected_data' })
    affectedData: string;

    @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
    timestamp: Date;

}