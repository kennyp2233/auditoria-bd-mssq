import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';

import { AnomalyCollector } from 'src/audit/anomaly.collector';
import { ReportGenerator } from 'src/audit/report.generator';
import { Anomaly } from './entities/anomaly.entity';

import {
  CRUD_QUERIES,
  REFERENTIAL_QUERIES,
  TABLE_QUERIES,
} from './sql/queries';
import { cleanSQLScript, deleteAllTablesExceptAnomaly } from 'src/utils/database-utils';
import { DatabaseConnectionDto } from './dto/database-connection.dto';


/**
 * Servicio principal para:
 * 1) Subir un script SQL (texto).
 * 2) Analizar la BD recién restaurada/creada.
 * 3) Registrar anomalías y generar reporte.
 */
@Injectable()
export class DatabaseAuditService {
  private readonly logger = new Logger(DatabaseAuditService.name);
  private dynamicDataSource: DataSource | null = null; 

  constructor(
    // Inyectamos el DataSource de TypeORM para hacer queries nativos
    private readonly dataSource: DataSource,
    private readonly anomalyCollector: AnomalyCollector,
    private readonly reportGenerator: ReportGenerator,

  ) { }

  /**
   * Ejemplo de subir un archivo (pero en tu caso no lo necesitas si
   * no recibes un .bak sino un script en texto).
   */
  async uploadDatabaseFile(file: Express.Multer.File): Promise<void> {
    if (!file) {
      throw new Error('No se recibió archivo');
    }

    const uploadPath = path.join(__dirname, '../../uploads', file.originalname);
    fs.writeFileSync(uploadPath, file.buffer);

    this.logger.log(`Archivo subido en: ${uploadPath}`);

    // 🔹 Leer el contenido del archivo y ejecutarlo
    const script = fs.readFileSync(uploadPath, 'utf-8');

    // 🔹 Llamar a `uploadDatabaseScript` para ejecutarlo
    await this.uploadDatabaseScript(script);

    this.anomalyCollector.clear();
  }

  async uploadDatabaseScript(script: string): Promise<void> {
    if (!script) {
      throw new Error('No se recibió script');
    }

    this.logger.log('Iniciando ejecución del script en la BD...');

    const queryRunner = this.dataSource.createQueryRunner();
    try {
      await queryRunner.connect();
      await queryRunner.query(`USE db_app;`);

      // 🔹 Eliminar todas las tablas excepto "Anomaly"
      await deleteAllTablesExceptAnomaly(queryRunner);

      // 🔹 Limpiar el script eliminando "CREATE DATABASE" y "USE ..."
      script = cleanSQLScript(script);

      // 🔹 Ejecutamos el nuevo script
      await this.executeSQLScript(script, queryRunner);

      this.logger.log('Script ejecutado exitosamente.');
    } catch (error) {
      this.logger.error(`Error ejecutando script: ${error.message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }

    // Limpiamos anomalías anteriores
    this.anomalyCollector.clear();
  }


  /**
   * 2. Analizar la base de datos recién subida/restaurada.
   *    - Descubrir relationships
   *    - Revisar integridad referencial
   *    - Revisar anomalías CRUD
   */
  async analyzeDatabase(): Promise<void> {
    this.anomalyCollector.clear();

    await this.discoverRelationships();
    await this.checkReferentialIntegrity();
    await this.checkCrudAnomalies();
  }

  /**
   * Retorna las anomalías almacenadas.
   */
  async getAnomalies(): Promise<Anomaly[]> {
    return this.anomalyCollector.getAnomalies();
  }

  /**
   * Genera un reporte de texto con las anomalías.
   */
  async generateReport(): Promise<string> {
    const anomalies = await this.anomalyCollector.getAnomalies();
    return this.reportGenerator.generateTextReport(anomalies);
  }

  // =================================================================
  // ======================= MÉTODOS PRIVADOS =========================
  // =================================================================

  /**
   * Ejecuta un script SQL que puede contener varias sentencias separadas
   * por "GO". Usa un QueryRunner específico para mantener control.
   */
  private async executeSQLScript(script: string, queryRunner: any) {
    // Dividir en statements por "GO" (puede variar si tu script usa otra forma)
    const statements = script
      .split(/\bGO\b/gi)
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0);

    for (const statement of statements) {
      await queryRunner.query(statement);
    }
  }

  /**
   * 2.1 Descubre relaciones potenciales basadas en "heurísticas"
   *    (por ejemplo columnas terminadas en "ID" que no sean FK reales).
   */
  private async discoverRelationships() {
    this.logger.log('Descubriendo relaciones potenciales...');

    // Obtenemos las tablas de usuario
    const tables = await this.dataSource.query(TABLE_QUERIES.GET_USER_TABLES);

    for (const t of tables) {
      const tableName = t.table_name;

      const existingFKs = await this.dataSource.query(
        TABLE_QUERIES.GET_EXISTING_FKS.replace('@tableName', tableName)
      );
      
      const fkColumns = new Set(existingFKs.map((x) => x.column_name));

      const cols = await this.dataSource.query(
        TABLE_QUERIES.GET_TABLE_COLUMNS.replace('{TABLE_NAME}', tableName)
      );

      for (const col of cols) {
        const colName = col.COLUMN_NAME;
        if (colName.endsWith('ID') && !fkColumns.has(colName)) {
          // Heurística sencilla: si la columna se llama "XID", buscamos tabla "Xs"
          const potentialRefTable = colName.slice(0, -2) + 's';

          const found = tables.find((x) => x.table_name === potentialRefTable);
          if (found) {
            await this.registrarAnomalia({
              type: 'FK_MISSING',
              description: `Posible FK faltante: ${tableName}.${colName} -> ${potentialRefTable}`,
              table: tableName,
              details: `Columna: ${colName}, Referencia: ${potentialRefTable}`,
            });
          }
        }
      }
    }
  }

  /**
   * 2.2 Verifica integridad referencial en las FKs definidas.
   *     - Busca valores huérfanos.
   */
  private async checkReferentialIntegrity() {
    this.logger.log('Verificando integridad referencial...');

    // Obtenemos TODAS las FKs definidas
    const fks = await this.dataSource.query(TABLE_QUERIES.GET_ALL_FOREIGN_KEYS);

    for (const fk of fks) {
      // Construimos la consulta que busca huérfanos
      const orphanQuery = REFERENTIAL_QUERIES.GET_ORPHAN_VALUES(
        fk.column_name,
        fk.table_name,
        fk.referenced_table,
        fk.referenced_column,
      );

      const orphans = await this.dataSource.query(orphanQuery);
      if (orphans.length > 0) {
        for (const row of orphans) {
          await this.registrarAnomalia({
            type: 'REFERENTIAL_INTEGRITY',
            description: `Valor huérfano en ${fk.table_name}.${fk.column_name}`,
            table: fk.table_name,
            details: `Valor: ${row.orphan_value}, Ocurrencias: ${row.count_orphans}`,
          });
        }
      }
    }
  }

  /**
   * 2.3 Chequea anomalías CRUD (muy básico).
   *     - Ej: Intentar un INSERT que viole FKs
   */
  private async checkCrudAnomalies() {
    this.logger.log('Verificando anomalías CRUD...');

    try {
      // Por ejemplo, un INSERT que seguramente falle si hay FKs sin cumplir
      await this.dataSource.query(CRUD_QUERIES.TEST_INSERT);
    } catch (err) {
      // Si falla, registramos la anomalía
      await this.registrarAnomalia({
        type: 'CRUD_ANOMALY',
        description: `Falló un INSERT (posible FK inexistente).`,
        table: 'SomeTable', // Ajusta según tu caso
        details: err.message,
      });
    }
  }

  /**
   * Registro un objeto Anomaly a través del AnomalyCollector.
   */
  private async registrarAnomalia(payload: {
    type: string;
    description: string;
    table: string;
    details?: string;
  }) {
    try {
      await this.anomalyCollector.addAnomaly({
        type: payload.type,
        description: payload.description,
        affectedTable: payload.table,
        affectedData: payload.details,
      });

      this.logger.warn(
        `[${payload.type}] ${payload.description} (Tabla: ${payload.table}) Detalles: ${payload.details}`,
      );
    } catch (error) {
      this.logger.error(`Error registrando anomalía: ${error.message}`);
    }
  };

  /**
   * Conecta dinámicamente a una base de datos externa.
   */
  async connectToDatabase(dbCredentials: DatabaseConnectionDto): Promise<void> {
    try {
      this.logger.log(`Intentando conectar a la BD: ${dbCredentials.database}`);

      // Cierra la conexión anterior si existe
      if (this.dynamicDataSource) {
        await this.dynamicDataSource.destroy();
        this.dynamicDataSource = null;
      }

      // Crea una nueva conexión
      this.dynamicDataSource = new DataSource({
        type: 'mssql',
        host: dbCredentials.host,
        port: dbCredentials.port,
        username: dbCredentials.username,
        password: dbCredentials.password,
        database: dbCredentials.database,
        options: {
          encrypt: false,
          trustServerCertificate: true,
        },
      });

      await this.dynamicDataSource.initialize();
      this.logger.log('✅ Conexión establecida correctamente.');
    } catch (error) {
      this.logger.error(`❌ Error al conectar con la base de datos: ${error.message}`);
      throw error;
    }
  }

  /**
   * Ejecuta los scripts de auditoría en la BD conectada.
   */
  async executeAuditScripts(): Promise<any[]> {
    if (!this.dynamicDataSource) {
      throw new Error('❌ No hay una conexión activa a una base de datos.');
    }

    this.logger.log('🔎 Ejecutando auditoría en la BD conectada...');
    const queryRunner = this.dynamicDataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      const anomalies = [];

      // 🔹 1. Obtener todas las tablas de usuario
      const tables = await queryRunner.query(TABLE_QUERIES.GET_USER_TABLES);
      anomalies.push({ step: 'user_tables', result: tables });

      // 🔹 2. Revisar claves foráneas existentes en cada tabla
      for (const t of tables) {
        const tableName = t.table_name;

        // Obtener claves foráneas
        const existingFKs = await queryRunner.query(
          TABLE_QUERIES.GET_EXISTING_FKS.replace('{TABLE_NAME}', tableName)
        );
        anomalies.push({ step: `existing_fks_${tableName}`, result: existingFKs });

        // Obtener columnas de la tabla
        const cols = await queryRunner.query(
          TABLE_QUERIES.GET_TABLE_COLUMNS.replace('{TABLE_NAME}', tableName)
        );
        anomalies.push({ step: `table_columns_${tableName}`, result: cols });
      }

      // 🔹 3. Verificar integridad referencial en todas las claves foráneas
      const fks = await queryRunner.query(TABLE_QUERIES.GET_ALL_FOREIGN_KEYS);
      for (const fk of fks) {
        const orphanQuery = REFERENTIAL_QUERIES.GET_ORPHAN_VALUES(
          fk.column_name,
          fk.table_name,
          fk.referenced_table,
          fk.referenced_column,
        );
        const orphans = await queryRunner.query(orphanQuery);
        if (orphans.length > 0) {
          anomalies.push({ step: `orphan_values_${fk.table_name}`, result: orphans });
        }
      }

      // 🔹 4. Intentar un INSERT para detectar problemas de claves foráneas
      try {
        await queryRunner.query(CRUD_QUERIES.TEST_INSERT);
      } catch (err) {
        anomalies.push({
          step: 'crud_anomalies',
          result: `INSERT fallido (posible FK inexistente): ${err.message}`,
        });
      }

      this.logger.log('✅ Análisis completado.');
      return anomalies;
    } catch (error) {
      this.logger.error(`❌ Error en la auditoría: ${error.message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
