// =====================
// TASK MANAGEMENT
// =====================
let currentFilter = 'all';

// Load tasks on page load
document.addEventListener('DOMContentLoaded', () => {
    loadTasks();
    setupEventListeners();
});

function setupEventListeners() {
    // Add task form
    const addTaskForm = document.getElementById('addTaskForm');
    if (addTaskForm) {
        addTaskForm.addEventListener('submit', addTask);
    }
    
    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            loadTasks();
        });
    });
}

async function addTask(e) {
    e.preventDefault();
    
    const title = document.getElementById('taskTitle').value;
    const description = document.getElementById('taskDesc').value;
    const priority = document.getElementById('taskPriority').value;
    const due_date = document.getElementById('taskDueDate').value;
    
    try {
        const response = await fetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, description, priority, due_date })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Clear form
            document.getElementById('taskTitle').value = '';
            document.getElementById('taskDesc').value = '';
            document.getElementById('taskDueDate').value = '';
            document.getElementById('taskPriority').value = 'medium';
            
            // Reload tasks
            loadTasks();
        } else {
            alert('Error adding task: ' + data.error);
        }
    } catch (err) {
        console.error('Error adding task:', err);
        alert('Failed to add task');
    }
}

async function loadTasks() {
    const container = document.getElementById('tasksContainer');
    container.innerHTML = '<div class="loading">Loading tasks...</div>';
    
    try {
        const response = await fetch(`/api/tasks?filter=${currentFilter}`);
        const data = await response.json();
        
        if (data.success) {
            renderTasks(data.tasks);
        } else {
            container.innerHTML = '<div class="loading">Error loading tasks</div>';
        }
    } catch (err) {
        console.error('Error loading tasks:', err);
        container.innerHTML = '<div class="loading">Error loading tasks</div>';
    }
}

function renderTasks(tasks) {
    const container = document.getElementById('tasksContainer');
    
    if (tasks.length === 0) {
        container.innerHTML = `
            <div class="loading">
                📭 No tasks found
                <p style="font-size: 14px; margin-top: 8px;">Add a new task using the form above</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = tasks.map(task => {
        const isCompleted = task.status
            ? task.status === 'completed'
            : !!task.completed;
        return `
        <div class="task-item" data-task-id="${task.id}">
            <button class="task-checkbox ${isCompleted ? 'completed' : ''}" 
                    onclick="toggleTaskStatus(${task.id}, ${isCompleted})">
                ${isCompleted ? '✓' : ''}
            </button>
            <div class="task-content">
                <div class="task-title ${isCompleted ? 'completed' : ''}">
                    ${escapeHtml(task.title)}
                </div>
                ${task.description ? `<div class="task-description">${escapeHtml(task.description)}</div>` : ''}
                <div class="task-meta">
                    <span class="priority-${task.priority}">
                        ${task.priority === 'high' ? '🔴' : task.priority === 'medium' ? '🟡' : '🟢'} 
                        ${task.priority}
                    </span>
                    ${task.due_date ? `<span>📅 Due: ${new Date(task.due_date).toLocaleDateString()}</span>` : ''}
                    <span>📝 Created: ${new Date(task.created_at).toLocaleDateString()}</span>
                    ${task.completed_at ? `<span>✅ Completed: ${new Date(task.completed_at).toLocaleDateString()}</span>` : ''}
                </div>
            </div>
            <button class="delete-btn" onclick="deleteTask(${task.id})">🗑️</button>
        </div>
    `;
    }).join('');
}

async function toggleTaskStatus(taskId, isCompleted) {
    const newStatus = isCompleted ? 'pending' : 'completed';
    
    try {
        const response = await fetch(`/api/tasks/${taskId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        
        const data = await response.json();
        
        if (data.success) {
            loadTasks();
        } else {
            alert('Error updating task: ' + data.error);
        }
    } catch (err) {
        console.error('Error updating task:', err);
        alert('Failed to update task');
    }
}

async function deleteTask(taskId) {
    if (!confirm('Are you sure you want to delete this task?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/tasks/${taskId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            loadTasks();
        } else {
            alert('Error deleting task: ' + data.error);
        }
    } catch (err) {
        console.error('Error deleting task:', err);
        alert('Failed to delete task');
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}