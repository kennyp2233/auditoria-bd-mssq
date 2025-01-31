export const TABLE_QUERIES = {
  GET_USER_TABLES: `
    SELECT t.name as table_name
    FROM sys.tables t
    INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE t.is_ms_shipped = 0
      AND s.name = 'dbo'
  `,

  GET_EXISTING_FKS: `
    SELECT 
      COL_NAME(fc.parent_object_id, fc.parent_column_id) as column_name
    FROM sys.foreign_keys AS f
    INNER JOIN sys.foreign_key_columns AS fc
      ON f.object_id = fc.constraint_object_id
    WHERE OBJECT_NAME(f.parent_object_id) = '{TABLE_NAME}'
  `,

  GET_TABLE_COLUMNS: `
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = '{TABLE_NAME}'
  `,

  GET_ALL_FOREIGN_KEYS: `
    SELECT 
      fk.name AS fk_name,
      OBJECT_NAME(fkc.parent_object_id) AS table_name,
      COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS column_name,
      OBJECT_NAME(fkc.referenced_object_id) AS referenced_table,
      COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) AS referenced_column
    FROM sys.foreign_keys fk
    INNER JOIN sys.foreign_key_columns fkc
      ON fk.object_id = fkc.constraint_object_id
  `
};

export const REFERENTIAL_QUERIES = {
  GET_ORPHAN_VALUES: (
    fkColumn: string,
    parentTable: string,
    referencedTable: string,
    referencedColumn: string
  ) => `
    SELECT t1.[${fkColumn}] as orphan_value, COUNT(*) as count_orphans
    FROM [${parentTable}] t1
    LEFT JOIN [${referencedTable}] t2
      ON t1.[${fkColumn}] = t2.[${referencedColumn}]
    WHERE t1.[${fkColumn}] IS NOT NULL
      AND t2.[${referencedColumn}] IS NULL
    GROUP BY t1.[${fkColumn}]
  `
};

export const CRUD_QUERIES = {
  TEST_INSERT: `
    BEGIN TRAN
    INSERT INTO SomeTable (SomeForeignKeyID) VALUES (999999)
    ROLLBACK TRAN
  `
};
