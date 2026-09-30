-- AMC Bank Database Migration V2__seed_data.sql

-- Seed Admin User (Username: admin, Password: admin123)
INSERT INTO users (username, password_hash, role)
VALUES ('admin', '$2a$10$dXJ3SW6G7P50lGmMkkmwe.20cQQubK3.HZWzG3YB1tlRy.fqv1Mqy', 'ROLE_ADMIN')
ON CONFLICT (username) DO NOTHING;

-- Seed Demo Customer 1 (Khushi Sharma)
INSERT INTO customers (id, name, email, phone_number, city, pan_number, address, kyc_status)
VALUES (1, 'Khushi Sharma', 'Khushi@example.com', '+919876543210', 'Mumbai', 'ABCDE1234F', '123 Marine Drive, Mumbai', 'VERIFIED')
ON CONFLICT (email) DO NOTHING;

-- Seed Customer 1 Login (Username: Khushi@example.com, Password: customer123)
INSERT INTO users (username, password_hash, role, customer_id)
VALUES ('Khushi@example.com', '$2a$10$e8w6WbH46E/B7n8MhP7L2u8a9zXv/1JzK6x4y2z0a1b2c3d4e5f6g', 'ROLE_CUSTOMER', 1)
ON CONFLICT (username) DO NOTHING;

-- Seed Accounts for Demo Customer 1
INSERT INTO accounts (id, account_number, type, balance, minimum_balance, daily_transfer_limit, status, customer_id)
VALUES (1, 'AC1002003001', 'SAVINGS', 150000.00, 1000.00, 100000.00, 'ACTIVE', 1),
       (2, 'AC1002003002', 'CURRENT', 450000.00, 5000.00, 500000.00, 'ACTIVE', 1)
ON CONFLICT (account_number) DO NOTHING;

-- Seed Sample Transactions
INSERT INTO transactions (reference_id, account_id, transaction_type, amount, balance_after, description)
VALUES ('TXN1000000001', 1, 'DEPOSIT', 150000.00, 150000.00, 'Initial Account Opening Deposit'),
       ('TXN1000000002', 2, 'DEPOSIT', 450000.00, 450000.00, 'Initial Business Deposit')
ON CONFLICT (reference_id) DO NOTHING;

-- Seed Demo Customer 2 (Priya Patel)
INSERT INTO customers (id, name, email, phone_number, city, pan_number, address, kyc_status)
VALUES (2, 'Priya Patel', 'priya@example.com', '+919812345678', 'Bengaluru', 'XYZPQ5678R', '45 MG Road, Bengaluru', 'VERIFIED')
ON CONFLICT (email) DO NOTHING;

-- Seed Customer 2 Login (Username: priya@example.com, Password: customer123)
INSERT INTO users (username, password_hash, role, customer_id)
VALUES ('priya@example.com', '$2a$10$e8w6WbH46E/B7n8MhP7L2u8a9zXv/1JzK6x4y2z0a1b2c3d4e5f6g', 'ROLE_CUSTOMER', 2)
ON CONFLICT (username) DO NOTHING;

INSERT INTO accounts (id, account_number, type, balance, minimum_balance, daily_transfer_limit, status, customer_id)
VALUES (3, 'AC1002003003', 'SAVINGS', 85000.00, 1000.00, 100000.00, 'ACTIVE', 2)
ON CONFLICT (account_number) DO NOTHING;

SELECT setval('customers_id_seq', (SELECT MAX(id) FROM customers));
SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));
SELECT setval('accounts_id_seq', (SELECT MAX(id) FROM accounts));
