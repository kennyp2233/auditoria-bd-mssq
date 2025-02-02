CREATE DATABASE AnomalyDB1;
GO
USE AnomalyDB1;
GO

CREATE TABLE Customers (
    CustomerID INT PRIMARY KEY,
    Name VARCHAR(100)
);
GO

CREATE TABLE Orders (
    OrderID INT PRIMARY KEY,
    CustomerID INT,
    Amount DECIMAL(10,2),
    FOREIGN KEY (CustomerID) REFERENCES Customers(CustomerID)
);
GO

-- ❌ Insertar un pedido con un CustomerID que no existe (anomalía referencial)
INSERT INTO Orders (OrderID, CustomerID, Amount) VALUES (1, 999, 100.00);
GO
