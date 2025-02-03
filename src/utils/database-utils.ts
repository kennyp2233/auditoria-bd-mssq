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

    // 🔽 Deshabilitar restricciones de Foreign Key antes de eliminar tablas
    logger.log('🔽 Desactivando restricciones de Foreign Keys...');
    await queryRunner.query(`
        DECLARE @sql NVARCHAR(MAX) = '';
        SELECT @sql += 'ALTER TABLE [' + TABLE_SCHEMA + '].[' + TABLE_NAME + '] NOCHECK CONSTRAINT ALL;' + CHAR(13)
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_NAME <> 'Anomaly';
        EXEC sp_executesql @sql;
    `);

    // 🔽 Deshabilitar triggers para evitar errores de dependencias
    logger.log('🔽 Desactivando triggers...');
    await queryRunner.query(`
        DECLARE @sql NVARCHAR(MAX) = '';
        SELECT @sql += 'DISABLE TRIGGER ALL ON [' + TABLE_SCHEMA + '].[' + TABLE_NAME + '];' + CHAR(13)
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_NAME <> 'Anomaly';
        EXEC sp_executesql @sql;
    `);

    // 🔽 Eliminar todas las tablas en el orden correcto
    for (const { TABLE_NAME } of tables) {
        logger.log(`🗑 Eliminando tabla: ${TABLE_NAME}...`);
        await queryRunner.query(`IF OBJECT_ID('${TABLE_NAME}', 'U') IS NOT NULL DROP TABLE [${TABLE_NAME}]`);
    }

    // 🔼 Reactivar restricciones de Foreign Key después de eliminar las tablas
    logger.log('🔼 Reactivando restricciones de Foreign Keys...');
    await queryRunner.query(`
        DECLARE @sql NVARCHAR(MAX) = '';
        SELECT @sql += 'ALTER TABLE [' + TABLE_SCHEMA + '].[' + TABLE_NAME + '] WITH CHECK CHECK CONSTRAINT ALL;' + CHAR(13)
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_NAME <> 'Anomaly';
        EXEC sp_executesql @sql;
    `);

    // 🔼 Reactivar triggers después de eliminar las tablas
    logger.log('🔼 Reactivando triggers...');
    await queryRunner.query(`
        DECLARE @sql NVARCHAR(MAX) = '';
        SELECT @sql += 'ENABLE TRIGGER ALL ON [' + TABLE_SCHEMA + '].[' + TABLE_NAME + '];' + CHAR(13)
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_NAME <> 'Anomaly';
        EXEC sp_executesql @sql;
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