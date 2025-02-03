import { Logger } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';

/**
 * Elimina todas las tablas de la base de datos excepto la tabla "Anomaly".
 */
export async function deleteAllTablesExceptAnomaly(queryRunner: QueryRunner): Promise<void> {
    const logger = new Logger('DatabaseUtils');
    logger.log('⚠ Eliminando todas las tablas excepto "Anomaly"...');

    const MAX_RETRIES = 3;
    let attempt = 0;

    while (attempt < MAX_RETRIES) {
        try {
            attempt++;
            await queryRunner.startTransaction();
            await queryRunner.query(`SET DEADLOCK_PRIORITY LOW;`);
            // Bloquear todas las tablas para evitar que otras transacciones interfieran
            await queryRunner.query(`SELECT 1 FROM INFORMATION_SCHEMA.TABLES WITH (TABLOCKX);`);

            // Obtener la lista de todas las tablas excepto "Anomaly"
            const tables: { TABLE_NAME: string }[] = await queryRunner.query(`
          SELECT TABLE_NAME 
          FROM INFORMATION_SCHEMA.TABLES 
          WHERE TABLE_TYPE = 'BASE TABLE' 
            AND TABLE_NAME <> 'Anomaly'
        `);

            if (tables.length === 0) {
                logger.log('✅ No hay tablas para eliminar.');
                await queryRunner.commitTransaction();
                return;
            }

            // Desactivar restricciones de Foreign Key
            logger.log('🔽 Desactivando restricciones de Foreign Keys...');
            await queryRunner.query(`EXEC sp_MSforeachtable 'ALTER TABLE ? NOCHECK CONSTRAINT ALL'`);

            // Desactivar triggers
            logger.log('🔽 Desactivando triggers...');
            await queryRunner.query(`EXEC sp_MSforeachtable 'DISABLE TRIGGER ALL ON ?'`);

            // Eliminar las tablas en el orden correcto
            for (const { TABLE_NAME } of tables) {
                logger.log(`🗑 Eliminando tabla: ${TABLE_NAME}...`);
                await queryRunner.query(`IF OBJECT_ID('${TABLE_NAME}', 'U') IS NOT NULL DROP TABLE [${TABLE_NAME}]`);
            }

            // Reactivar restricciones de Foreign Key
            logger.log('🔼 Reactivando restricciones de Foreign Keys...');
            await queryRunner.query(`EXEC sp_MSforeachtable 'ALTER TABLE ? WITH CHECK CHECK CONSTRAINT ALL'`);

            // Reactivar triggers
            logger.log('🔼 Reactivando triggers...');
            await queryRunner.query(`EXEC sp_MSforeachtable 'ENABLE TRIGGER ALL ON ?'`);

            await queryRunner.commitTransaction();
            logger.log('✅ Todas las tablas excepto "Anomaly" han sido eliminadas con éxito.');
            break;
        } catch (error) {
            await queryRunner.rollbackTransaction();
            logger.error(`❌ Error en intento ${attempt}: ${error.message}`);
            if (attempt >= MAX_RETRIES) {
                throw new Error('🔥 Transacción fallida después de varios intentos debido a un deadlock.');
            }
        }
    }
}


/**
 * Limpia y sanitiza el script SQL:
 * 1. Remueve "CREATE DATABASE" y "USE".
 * 2. Mantiene la estructura original del script.
 * 3. Elimina líneas vacías innecesarias.
 * 4. Separa correctamente los bloques de código.
 */
export function cleanSQLScript(script: string): string {
    return script
        .split(/\r?\n/) // Divide el script en líneas
        .map(line => line.trim()) // Elimina espacios innecesarios
        .filter(line =>
            !line.toUpperCase().startsWith('CREATE DATABASE') &&
            !line.toUpperCase().startsWith('USE ') &&
            !line.startsWith('--') // Elimina comentarios de línea
        )
        .join('\n') // Vuelve a unir las líneas en un solo string
        .replace(/\bGO\b/gi, ''); // Elimina "GO" sin afectar la ejecución
}

export async function clearAnomalyTable(dataSource: DataSource): Promise<void> {
    const logger = new Logger('AnomalyClear');
    const MAX_RETRIES = 3;
    let attempt = 0;
    const queryRunner = dataSource.createQueryRunner();

    try {
        await queryRunner.connect();
        while (attempt < MAX_RETRIES) {
            try {
                attempt++;
                await queryRunner.startTransaction();
                // Se asume que la tabla se llama "Anomaly" y se usa el esquema por defecto [dbo]
                await queryRunner.query('DELETE FROM [Anomaly]');
                await queryRunner.commitTransaction();
                logger.log('Tabla Anomaly limpiada correctamente.');
                break;
            } catch (error) {
                await queryRunner.rollbackTransaction();
                logger.error(`Error limpiando Anomaly en intento ${attempt}: ${error.message}`);
                if (attempt >= MAX_RETRIES) {
                    throw new Error('Fallo al limpiar la tabla Anomaly después de varios intentos.');
                }
            }
        }
    } finally {
        await queryRunner.release();
    }
}