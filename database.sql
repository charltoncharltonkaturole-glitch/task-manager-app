-- =====================================================
-- TASKFLOW — COMPLETE DATABASE SETUP
-- Run this in your Railway MySQL shell
-- =====================================================

USE railway;

-- USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    username     VARCHAR(50)  NOT NULL UNIQUE,
    email        VARCHAR(100) NOT NULL UNIQUE,
    password     VARCHAR(255) NOT NULL,
    role         ENUM('user', 'admin') DEFAULT 'user',
    last_login   TIMESTAMP NULL,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- TASKS TABLE
CREATE TABLE IF NOT EXISTS tasks (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    user_id      INT NOT NULL,
    title        VARCHAR(255) NOT NULL,
    description  TEXT,
    priority     ENUM('low', 'medium', 'high') DEFAULT 'medium',
    status       ENUM('pending', 'completed') DEFAULT 'pending',
    completed    BOOLEAN DEFAULT FALSE,
    due_date     DATE NULL,
    completed_at TIMESTAMP NULL,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- VISITORS TABLE
CREATE TABLE IF NOT EXISTS visitors (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    session_id   VARCHAR(100),
    user_id      INT NULL,
    page         VARCHAR(255),
    ip_address   VARCHAR(45),
    visited_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- MESSAGES TABLE
CREATE TABLE IF NOT EXISTS messages (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    user_id      INT NULL,
    subject      VARCHAR(255),
    body         TEXT NOT NULL,
    is_read      BOOLEAN DEFAULT FALSE,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- =====================================================
-- DEFAULT ADMIN ACCOUNT
-- Email:    admin@taskmanager.com
-- Password: password
-- CHANGE THIS after first login!
-- =====================================================
INSERT INTO users (username, email, password, role)
VALUES (
    'admin',
    'admin@taskmanager.com',
    '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    'admin'
) ON DUPLICATE KEY UPDATE id=id;

-- Verify tables were created
SHOW TABLES;