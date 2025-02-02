CREATE DATABASE AnomalyDB2;
GO
USE AnomalyDB2;
GO

CREATE TABLE Employees (
    EmployeeID INT PRIMARY KEY,
    Name VARCHAR(100)
);
GO

-- ❌ Intentar insertar un EmployeeID duplicado
INSERT INTO Employees (EmployeeID, Name) VALUES (1, 'John Doe');
INSERT INTO Employees (EmployeeID, Name) VALUES (1, 'Jane Doe'); -- ❌ Esto causará error
GO
