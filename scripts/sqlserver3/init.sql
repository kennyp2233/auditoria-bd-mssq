-- 🔹 Crear la base de datos
CREATE DATABASE AuditAnomalies;
GO
USE AuditAnomalies;
GO

-- 🔹 1. Crear la tabla de Clientes
CREATE TABLE Customers (
    CustomerID INT PRIMARY KEY,
    Name VARCHAR(100)
);
GO

-- 🔹 2. Crear la tabla de Pedidos con clave foránea a Customers
CREATE TABLE Orders (
    OrderID INT PRIMARY KEY,
    CustomerID INT,  -- Clave foránea a Customers
    Amount DECIMAL(10,2),
    FOREIGN KEY (CustomerID) REFERENCES Customers(CustomerID)
);
GO

-- 🔹 3. Crear la tabla de Productos
CREATE TABLE Products (
    ProductID INT PRIMARY KEY,
    Name VARCHAR(100),
    Price DECIMAL(10,2)
);
GO

-- 🔹 4. Crear la tabla de Detalles de Pedido con FK a Orders y Products
CREATE TABLE OrderDetails (
    OrderDetailID INT PRIMARY KEY,
    OrderID INT,
    ProductID INT,
    Quantity INT,
    FOREIGN KEY (OrderID) REFERENCES Orders(OrderID),
    FOREIGN KEY (ProductID) REFERENCES Products(ProductID)
);
GO

-- 🔹 5. Crear la tabla de Empleados con FK a Departamentos (que aún no existe)
CREATE TABLE Employees (
    EmployeeID INT PRIMARY KEY,
    Name VARCHAR(100),
    DepartmentID INT  -- FK a una tabla que aún no hemos creado
);
GO

-- 🚨 Desactivar temporalmente las claves foráneas para insertar anomalías
ALTER TABLE Orders NOCHECK CONSTRAINT ALL;
ALTER TABLE OrderDetails NOCHECK CONSTRAINT ALL;
ALTER TABLE Employees NOCHECK CONSTRAINT ALL;
GO

-- ❌ Insertar valores huérfanos en Orders (CustomerID = 999 no existe en Customers)
INSERT INTO Orders (OrderID, CustomerID, Amount) VALUES (1, 999, 200.50);
GO

-- ❌ Insertar valores huérfanos en OrderDetails (OrderID = 999 y ProductID = 999 no existen)
INSERT INTO OrderDetails (OrderDetailID, OrderID, ProductID, Quantity) VALUES (1, 999, 999, 2);
GO

-- ❌ Insertar clave primaria duplicada en Employees
INSERT INTO Employees (EmployeeID, Name, DepartmentID) VALUES (1, 'John Doe', 1);
INSERT INTO Employees (EmployeeID, Name, DepartmentID) VALUES (1, 'Jane Doe', 1);  -- 🚨 Esto causará error si las PKs están activas
GO

-- ❌ Insertar empleados en un departamento que no existe
INSERT INTO Employees (EmployeeID, Name, DepartmentID) VALUES (2, 'Alice Smith', 500);
GO

-- 🔄 Reactivar las claves foráneas después de insertar anomalías
ALTER TABLE Orders CHECK CONSTRAINT ALL;
ALTER TABLE OrderDetails CHECK CONSTRAINT ALL;
ALTER TABLE Employees CHECK CONSTRAINT ALL;
GO
