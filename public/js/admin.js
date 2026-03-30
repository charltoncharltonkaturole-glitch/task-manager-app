// =====================
// ADMIN DASHBOARD
// =====================
let currentSection = 'dashboard';

document.addEventListener('DOMContentLoaded', () => {
    loadDashboardStats();
    setupAdminNavigation();
    setInterval(loadDashboardStats, 30000); // Refresh every 30 seconds
});

function setupAdminNavigation() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const section = link.dataset.section;
            
            // Update active states
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            
            // Show selected section
            document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
            document.getElementById(`${section}Section`).classList.add('active');
            
            currentSection = section;
            
            // Load section data
            if (section === 'messages') {
                loadMessages();
            } else if (section === 'visitors') {
                loadAllVisitors();
            } else if (section === 'users') {
                loadUsers();
            } else if (section === 'dashboard') {
                loadDashboardStats();
            }
        });
    });
}

async function loadDashboardStats() {
    try {
        const response = await fetch('/api/admin/stats');
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('totalUsers').textContent = data.stats.totalUsers;
            document.getElementById('totalTasks').textContent = data.stats.totalTasks;
            document.getElementById('completedTasks').textContent = data.stats.completedTasks;
            document.getElementById('pendingTasks').textContent = data.stats.pendingTasks;
            document.getElementById('totalVisitors').textContent = data.stats.totalVisitors;
            document.getElementById('todayVisitors').textContent = data.stats.todayVisitors;
            document.getElementById('unreadMessages').textContent = data.stats.unreadMessages;
            
            renderVisitorsTable(data.recentVisitors);
        }
    } catch (err) {
        console.error('Error loading stats:', err);
    }
}

function renderVisitorsTable(visitors) {
    const tbody = document.querySelector('#visitorsTable tbody');
    if (!tbody) return;
    
    tbody.innerHTML = visitors.map(visitor => `
        <tr>
            <td>${visitor.ip_address || 'Unknown'}</td>
            <td>${visitor.page_visited || 'Unknown'}</td>
            <td>${new Date(visitor.visited_at).toLocaleString()}</td>
        </tr>
    `).join('');
}

async function loadMessages() {
    const container = document.getElementById('messagesContainer');
    container.innerHTML = '<div class="loading">Loading messages...</div>';
    
    try {
        const response = await fetch('/api/admin/stats');
        const data = await response.json();
        
        if (data.success && data.messages) {
            renderMessages(data.messages);
        } else {
            container.innerHTML = '<div class="loading">No messages found</div>';
        }
    } catch (err) {
        console.error('Error loading messages:', err);
        container.innerHTML = '<div class="loading">Error loading messages</div>';
    }
}

function renderMessages(messages) {
    const container = document.getElementById('messagesContainer');
    
    if (messages.length === 0) {
        container.innerHTML = '<div class="loading">No messages yet</div>';
        return;
    }
    
    container.innerHTML = messages.map(msg => `
        <div class="message-card ${!msg.is_read ? 'unread' : ''}" data-message-id="${msg.id}">
            <div class="message-header">
                <div>
                    <div class="message-subject">${escapeHtml(msg.subject || 'No Subject')}</div>
                    <div class="message-meta">From: ${escapeHtml(msg.name)} (${escapeHtml(msg.email)})</div>
                </div>
                <div class="message-meta">${new Date(msg.created_at).toLocaleString()}</div>
            </div>
            <div class="message-content">${escapeHtml(msg.message)}</div>
            <div class="message-actions">
                ${!msg.is_read ? `<button class="mark-read-btn" onclick="markMessageRead(${msg.id})">Mark as Read</button>` : ''}
                <button class="delete-message-btn" onclick="deleteMessage(${msg.id})">Delete</button>
            </div>
        </div>
    `).join('');
}

async function markMessageRead(messageId) {
    try {
        const response = await fetch(`/api/admin/messages/${messageId}/read`, {
            method: 'PUT'
        });
        
        const data = await response.json();
        if (data.success) {
            loadMessages();
            loadDashboardStats();
        }
    } catch (err) {
        console.error('Error marking message read:', err);
    }
}

async function deleteMessage(messageId) {
    if (!confirm('Delete this message?')) return;
    
    try {
        const response = await fetch(`/api/admin/messages/${messageId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        if (data.success) {
            loadMessages();
            loadDashboardStats();
        }
    } catch (err) {
        console.error('Error deleting message:', err);
    }
}

async function loadAllVisitors() {
    const tbody = document.querySelector('#allVisitorsTable tbody');
    if (!tbody) return;
    
    try {
        const response = await fetch('/api/admin/stats');
        const data = await response.json();
        
        if (data.success && data.recentVisitors) {
            tbody.innerHTML = data.recentVisitors.map(visitor => `
                <tr>
                    <td>${visitor.ip_address || 'Unknown'}</td>
                    <td>${visitor.page_visited || 'Unknown'}</td>
                    <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis;">
                        ${visitor.user_agent ? visitor.user_agent.substring(0, 50) + '...' : 'Unknown'}
                    </td>
                    <td>${new Date(visitor.visited_at).toLocaleString()}</td>
                </tr>
            `).join('');
        }
    } catch (err) {
        console.error('Error loading visitors:', err);
    }
}

async function loadUsers() {
    const tbody = document.querySelector('#usersTable tbody');
    if (!tbody) return;
    
    try {
        const response = await fetch('/api/admin/users');
        const data = await response.json();
        
        if (data.success) {
            tbody.innerHTML = data.users.map(user => `
                <tr>
                    <td>${user.id}</td>
                    <td>${escapeHtml(user.username)}</td>
                    <td>${escapeHtml(user.email)}</td>
                    <td><span class="priority-${user.role === 'admin' ? 'high' : 'low'}">${user.role}</span></td>
                    <td>${new Date(user.created_at).toLocaleDateString()}</td>
                    <td>${user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}</td>
                </tr>
            `).join('');
        }
    } catch (err) {
        console.error('Error loading users:', err);
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}