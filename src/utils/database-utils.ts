import { Logger } from '@nestjs/common';
import { QueryRunner } from 'typeorm';

/**
 * Elimina todas las tablas de la base de datos excepto la tabla "Anomaly".
 */
export async function deleteAllTablesExceptAnomaly(queryRunner: QueryRunner) {
    const logger = new Logger('DatabaseUtils');

    logger.log('Eliminando todas las tablas excepto "Anomaly"...');

    // Obtener lista de tablas excepto "Anomaly"
    const tables = await queryRunner.query(`
    SELECT TABLE_NAME 
    FROM INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_NAME <> 'Anomaly'
  `);

    // Deshabilitar restricciones antes de eliminar
    await queryRunner.query('EXEC sp_MSforeachtable "ALTER TABLE ? NOCHECK CONSTRAINT all"');

    // Borrar todas las tablas encontradas
    for (const table of tables) {
        const tableName = table.TABLE_NAME;
        logger.log(`Eliminando tabla: ${tableName}`);
        await queryRunner.query(`DROP TABLE ${tableName}`);
    }

    // Habilitar restricciones nuevamente
    await queryRunner.query('EXEC sp_MSforeachtable "ALTER TABLE ? WITH CHECK CHECK CONSTRAINT all"');

    logger.log('Todas las tablas excepto "Anomaly" han sido eliminadas.');
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