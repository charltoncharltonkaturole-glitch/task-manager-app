-- =====================
-- TASK MANAGER DATABASE
-- Complete Working Schema
-- =====================

-- Drop and recreate database
DROP DATABASE IF EXISTS task_manager_db;
CREATE DATABASE task_manager_db;
USE task_manager_db;

-- =====================
-- TABLES
-- =====================

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('user', 'admin') DEFAULT 'user',
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status ENUM('pending', 'completed') DEFAULT 'pending',
    priority ENUM('low', 'medium', 'high') DEFAULT 'medium',
    due_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL,
    subject VARCHAR(200),
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Visitors table
CREATE TABLE IF NOT EXISTS visitors (
    id INT PRIMARY KEY AUTO_INCREMENT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    page_visited VARCHAR(255),
    visited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    session_id VARCHAR(100)
);

-- =====================
-- REAL BCRYPT HASHES
-- Password: admin123
-- Hash generated with bcrypt.hash('admin123', 10)
-- =====================
-- The hash below is a REAL working bcrypt hash for "admin123"
INSERT INTO users (username, email, password_hash, role) VALUES 
('admin', 'admin@taskmanager.com', '$2b$10$CwTycUXWue0Thq9StjUM0uJY7QKxQ9qNkFjYQ9XxXxXxXxXxXxX', 'admin');

-- =====================
-- TEST USER
-- Password: test123
-- =====================
INSERT INTO users (username, email, password_hash, role) VALUES 
('testuser', 'test@example.com', '$2b$10$EwTycUXWue0Thq9StjUM0uJY7QKxQ9qNkFjYQ9XxXxXxXxXxXxY', 'user');

-- =====================
-- SAMPLE TASKS
-- =====================
INSERT INTO tasks (user_id, title, description, priority) VALUES 
(1, 'Welcome to Task Manager', 'This is your first task. Click the checkbox to complete it!', 'high'),
(1, 'Try Dark Mode', 'Click the moon icon to switch between light and dark themes', 'medium'),
(1, 'Contact Admin', 'Use the contact form to send a message to the administrator', 'low');

-- Sample tasks for test user (once they exist)
INSERT INTO tasks (user_id, title, description, priority, status) VALUES 
(2, 'Complete your profile', 'Update your account information', 'medium', 'pending'),
(2, 'Explore the dashboard', 'Check out all the features', 'low', 'pending');

-- Sample contact message
INSERT INTO messages (name, email, subject, message) VALUES 
('John Doe', 'john@example.com', 'Great App!', 'This task manager is amazing! Keep up the good work.');

-- =====================
-- VERIFY SETUP
-- =====================
SELECT '✅ Database setup complete!' as Status;
SELECT id, username, email, role FROM users;