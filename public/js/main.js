// =====================
// DARK MODE TOGGLE
// =====================
const darkModeToggle = document.getElementById('darkModeToggle');

if (darkModeToggle) {
    // Check for saved preference
    const darkMode = localStorage.getItem('darkMode') === 'enabled';
    if (darkMode) {
        document.body.classList.add('dark-mode');
        darkModeToggle.textContent = '☀️';
    }
    
    darkModeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        
        if (document.body.classList.contains('dark-mode')) {
            localStorage.setItem('darkMode', 'enabled');
            darkModeToggle.textContent = '☀️';
        } else {
            localStorage.setItem('darkMode', 'disabled');
            darkModeToggle.textContent = '🌙';
        }
    });
}

// =====================
// MOBILE MENU
// =====================
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const sidebar = document.querySelector('.sidebar');

if (mobileMenuBtn && sidebar) {
    mobileMenuBtn.addEventListener('click', () => {
        sidebar.classList.toggle('open');
    });
    
    // Close menu when clicking a link
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            sidebar.classList.remove('open');
        });
    });
}

// =====================
// LOGOUT FUNCTIONALITY
// =====================
const logoutBtn = document.getElementById('logoutBtn');

if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        try {
            const response = await fetch('/api/logout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            const data = await response.json();
            if (data.success) {
                window.location.href = '/login';
            }
        } catch (err) {
            console.error('Logout error:', err);
        }
    });
}

// =====================
// GET USER NAME
// =====================
async function getUserName() {
    try {
        const response = await fetch('/api/user');
        if (response.ok) {
            const data = await response.json();
            const userNameSpan = document.getElementById('userName');
            if (userNameSpan) {
                userNameSpan.textContent = (data.user && data.user.username) ? data.user.username : '';
            }
        }
    } catch (err) {
        console.error('Error getting user name:', err);
    }
}

// Run on page load
document.addEventListener('DOMContentLoaded', () => {
    getUserName();
});