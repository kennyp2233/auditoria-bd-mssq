-- Crear tabla de log para registrar anomalías
CREATE TABLE LogAnomalias (
   LogID INT IDENTITY(1,1) PRIMARY KEY,
   FechaHora DATETIME DEFAULT GETDATE(),
   TipoAnomalia VARCHAR(50),
   Descripcion VARCHAR(MAX),
   TablaAfectada VARCHAR(50),
   DatosAfectados VARCHAR(MAX)
);
 
-- Crear tablas principales
CREATE TABLE Facultades (
   FacultadID INT PRIMARY KEY,
   Nombre VARCHAR(100) NOT NULL,
   Presupuesto DECIMAL(10,2) CHECK (Presupuesto >= 0)
);
 
CREATE TABLE Departamentos (
   DepartamentoID INT PRIMARY KEY,
   Nombre VARCHAR(100) NOT NULL,
   FacultadID INT,  -- Intencionalmente sin FK para análisis
   Ubicacion VARCHAR(100)
);
 
CREATE TABLE Profesores (
   ProfesorID INT PRIMARY KEY,
   Nombre VARCHAR(100) NOT NULL,
   DepartamentoID INT,
   Email VARCHAR(100),
   Salario DECIMAL(10,2) CHECK (Salario > 0)
);
 
CREATE TABLE Cursos (
   CursoID INT PRIMARY KEY,
   Nombre VARCHAR(100) NOT NULL,
   ProfesorID INT,
   Creditos INT CHECK (Creditos BETWEEN 1 AND 6)
);
 
-- Datos de prueba
INSERT INTO Facultades VALUES
(1, 'Ingeniería', 1000000),
(2, 'Ciencias', 800000);
 
INSERT INTO Departamentos VALUES
(1, 'Sistemas', 99, 'Edificio A'),
(2, 'Matemáticas', 2, 'Edificio B'),
(3, 'Física', NULL, 'Edificio C');
 
--pendiente
ALTER TABLE Profesores NOCHECK CONSTRAINT ALL;
INSERT INTO Profesores VALUES
(1, 'Juan Pérez', 2, 'juanperez', 50000),
(2, 'María García', 99, 'maria@universidad.edu', 55000),
(3, 'Carlos López', 1, 'carlos@universidad.edu', -1000);
ALTER TABLE Profesores CHECK CONSTRAINT ALL;
 
--pendiente
ALTER TABLE Cursos NOCHECK CONSTRAINT ALL;
INSERT INTO Cursos VALUES
(1, 'Programación', 1, 4),
(2, 'Cálculo', 99, 5),
(3, 'Física Básica', 3, 8);
ALTER TABLE Cursos CHECK CONSTRAINT ALL;