IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'db_app')
BEGIN
    CREATE DATABASE db_app;
END
