import { Logger } from '@nestjs/common';
import { QueryRunner } from 'typeorm';

/**
 * Elimina todas las tablas de la base de datos excepto la tabla "Anomaly".
 */
export async function deleteAllTablesExceptAnomaly(queryRunner: QueryRunner) {
    const logger = new Logger('DatabaseUtils');

    logger.log('⚠ Eliminando todas las tablas excepto "Anomaly"...');

    // Obtener lista de todas las tablas excepto "Anomaly"
    const tables: { TABLE_NAME: string }[] = await queryRunner.query(`
        SELECT TABLE_NAME 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_TYPE = 'BASE TABLE' 
        AND TABLE_NAME <> 'Anomaly'
    `);

    if (tables.length === 0) {
        logger.log('✅ No hay tablas para eliminar.');
        return;
    }

    // 🔹 Deshabilitar restricciones de Foreign Key en todas las tablas
    logger.log('🔽 Desactivando restricciones de Foreign Keys...');
    await queryRunner.query(`
        EXEC sp_MSforeachtable 'ALTER TABLE ? NOCHECK CONSTRAINT ALL'
    `);

    // 🔹 Deshabilitar triggers para evitar errores de dependencias
    logger.log('🔽 Desactivando triggers...');
    await queryRunner.query(`
        EXEC sp_MSforeachtable 'DISABLE TRIGGER ALL ON ?'
    `);

    // 🔹 Eliminar todas las tablas en el orden correcto
    for (const { TABLE_NAME } of tables) {
        logger.log(`🗑 Eliminando tabla: ${TABLE_NAME}...`);
        await queryRunner.query(`DROP TABLE [${TABLE_NAME}]`);
    }

    // 🔹 Volver a habilitar restricciones de Foreign Key
    logger.log('🔼 Reactivando restricciones de Foreign Keys...');
    await queryRunner.query(`
        EXEC sp_MSforeachtable 'ALTER TABLE ? WITH CHECK CHECK CONSTRAINT ALL'
    `);

    // 🔹 Reactivar triggers
    logger.log('🔼 Reactivando triggers...');
    await queryRunner.query(`
        EXEC sp_MSforeachtable 'ENABLE TRIGGER ALL ON ?'
    `);

    logger.log('✅ Todas las tablas excepto "Anomaly" han sido eliminadas con éxito.');
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