const API_URL = '/api';
let currentEditId = null;

// Auth Logic
const isLoginPage = window.location.pathname.endsWith('login.html');
const token = localStorage.getItem('sims_token');

if (!token && !isLoginPage) {
    window.location.href = 'login.html';
}

if (token && isLoginPage) {
    window.location.href = 'index.html';
}

// Charts
let categoryChartInstance = null;
let stockChartInstance = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    if (isLoginPage) {
        setupLogin();
    } else {
        fetchDashboardStats();
        setupLogout();
    }
});

function setupLogin() {
    const loginForm = document.getElementById('login-form');
    if (!loginForm) return;

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const errorMsg = document.getElementById('error-msg');

        try {
            const response = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await response.json();

            if (data.success) {
                localStorage.setItem('sims_token', data.token);
                window.location.href = 'index.html';
            } else {
                errorMsg.innerText = data.message;
                errorMsg.style.display = 'block';
            }
        } catch (error) {
            console.error('Login error:', error);
            errorMsg.innerText = 'Server error. Try again.';
            errorMsg.style.display = 'block';
        }
    });
}

function setupLogout() {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('sims_token');
            window.location.href = 'login.html';
        });
    }
}

// Navigation
function showSection(sectionId) {
    document.querySelectorAll('.content-section').forEach(el => el.style.display = 'none');
    document.getElementById(sectionId).style.display = 'block';

    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    event.currentTarget.classList.add('active'); // Assumes button triggered this

    document.getElementById('page-title').innerText = sectionId.charAt(0).toUpperCase() + sectionId.slice(1);

    if (sectionId === 'inventory') {
        fetchItems();
    } else if (sectionId === 'dashboard') {
        fetchDashboardStats();
    } else if (sectionId === 'reports') {
        fetchReports();
    }
}

// Fetch Dashboard Stats & Render Charts
async function fetchDashboardStats() {
    try {
        const response = await fetch(`${API_URL}/dashboard`);
        const data = await response.json();

        document.getElementById('total-items-count').innerText = data.totalItems;
        document.getElementById('low-stock-count').innerText = data.lowStockCount;

        const lowStockList = document.getElementById('low-stock-list');
        lowStockList.innerHTML = '';

        if (data.lowStockItems.length === 0) {
            lowStockList.innerHTML = '<tr><td colspan="5" style="text-align:center;">No low stock items!</td></tr>';
        } else {
            data.lowStockItems.forEach(item => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${item.name}</td>
                    <td>${item.category}</td>
                    <td>${item.quantity} ${item.unit}</td>
                    <td>${item.min_threshold}</td>
                    <td><span class="status-badge status-low">Low Stock</span></td>
                `;
                lowStockList.appendChild(row);
            });
        }

        // Also fetch all items to populate charts
        const itemsResponse = await fetch(`${API_URL}/items`);
        const items = await itemsResponse.json();
        renderCharts(items);

    } catch (error) {
        console.error('Error fetching stats:', error);
    }
}

function renderCharts(items) {
    if (items.length === 0) return;

    // Prepare Data
    const categories = {};
    items.forEach(item => {
        categories[item.category] = (categories[item.category] || 0) + 1;
    });

    // Pie Chart
    const ctxPie = document.getElementById('categoryChart').getContext('2d');
    if (categoryChartInstance) categoryChartInstance.destroy(); // Destroy old chart to avoid overlay

    categoryChartInstance = new Chart(ctxPie, {
        type: 'doughnut',
        data: {
            labels: Object.keys(categories),
            datasets: [{
                data: Object.values(categories),
                backgroundColor: ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']
            }]
        },
        options: { responsive: true }
    });

    // Bar Chart (Top 5 Stock)
    const topItems = items.sort((a, b) => b.quantity - a.quantity).slice(0, 5);
    const ctxBar = document.getElementById('stockChart').getContext('2d');
    if (stockChartInstance) stockChartInstance.destroy();

    stockChartInstance = new Chart(ctxBar, {
        type: 'bar',
        data: {
            labels: topItems.map(i => i.name),
            datasets: [{
                label: 'Quantity',
                data: topItems.map(i => i.quantity),
                backgroundColor: '#4f46e5'
            }]
        },
        options: { responsive: true, scales: { y: { beginAtZero: true } } }
    });
}

// Fetch Items with Search & Filter
async function fetchItems() {
    const search = document.getElementById('search-bar').value;
    const category = document.getElementById('category-filter').value;

    let url = `${API_URL}/items?`;
    if (search) url += `search=${encodeURIComponent(search)}&`;
    if (category) url += `category=${encodeURIComponent(category)}`;

    try {
        const response = await fetch(url);
        const items = await response.json();
        renderItems(items);
    } catch (error) {
        console.error('Error fetching items:', error);
    }
}

function renderItems(items) {
    const list = document.getElementById('inventory-list');
    list.innerHTML = '';

    items.forEach(item => {
        const isLow = item.quantity <= item.min_threshold;
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.name} ${isLow ? '<i class="fa-solid fa-triangle-exclamation" style="color:var(--danger); margin-left:5px;" title="Low Stock"></i>' : ''}</td>
            <td>${item.category}</td>
            <td>${item.quantity} ${item.unit}</td>
            <td>
                <button class="btn-icon" onclick="editItem(${item.id}, '${item.name}', '${item.category}', ${item.quantity}, '${item.unit}', ${item.min_threshold})"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-icon" onclick="deleteItem(${item.id})"><i class="fa-solid fa-trash" style="color:var(--danger)"></i></button>
            </td>
        `;
        list.appendChild(row);
    });
}

// Modal Functions
function openModal(mode) {
    const modal = document.getElementById('item-modal');
    modal.style.display = 'flex';
    if (mode === 'add') {
        document.getElementById('modal-title').innerText = 'Add New Item';
        document.getElementById('item-form').reset();
        currentEditId = null;
    }
}

function closeModal() {
    document.getElementById('item-modal').style.display = 'none';
}

// Form Submission (Add/Edit)
document.getElementById('item-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const itemData = {
        name: document.getElementById('item-name').value,
        category: document.getElementById('item-category').value,
        quantity: parseInt(document.getElementById('item-quantity').value),
        unit: document.getElementById('item-unit').value,
        min_threshold: parseInt(document.getElementById('item-threshold').value)
    };

    const method = currentEditId ? 'PUT' : 'POST';
    const url = currentEditId ? `${API_URL}/items/${currentEditId}` : `${API_URL}/items`;

    try {
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(itemData)
        });

        if (response.ok) {
            closeModal();
            fetchItems();
            fetchDashboardStats(); // Refresh dashboard stats too preferably
        } else {
            alert('Error saving item');
        }
    } catch (error) {
        console.error('Error saving item:', error);
    }
});

// Edit & Delete
function editItem(id, name, category, quantity, unit, threshold) {
    currentEditId = id;
    document.getElementById('item-name').value = name;
    document.getElementById('item-category').value = category;
    document.getElementById('item-quantity').value = quantity;
    document.getElementById('item-unit').value = unit;
    document.getElementById('item-threshold').value = threshold;

    document.getElementById('modal-title').innerText = 'Edit Item';
    openModal('edit');
}

async function deleteItem(id) {
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
        await fetch(`${API_URL}/items/${id}`, { method: 'DELETE' });
        fetchItems();
        fetchDashboardStats();
    } catch (error) {
        console.error('Error deleting item:', error);
    }
}

// Reports & Trends
async function fetchReports() {
    try {
        // Fetch Real predictions
        const response = await fetch(`${API_URL}/predictions`);
        const predictions = await response.json();
        displayUsageTrends(predictions);

        // Fetch Logs
        const logsResponse = await fetch(`${API_URL}/logs`);
        const logs = await logsResponse.json();
        renderLogs(logs);

    } catch (error) {
        console.error('Error fetching reports:', error);
    }
}

function displayUsageTrends(items) {
    const container = document.getElementById('reports-content');
    if (!container) return;

    let html = `
        <table class="styled-table">
            <thead>
                <tr>
                    <th>Item</th>
                    <th>Current Stock</th>
                    <th>Avg Daily Usage (7 Days)</th>
                    <th>Est. Days Left</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
    `;

    items.forEach(item => {
        const daysLeft = item.daysLeft;
        let status = '<span class="status-badge status-ok">Good</span>';
        if (daysLeft < 5) status = '<span class="status-badge status-low">Critical</span>';
        if (daysLeft > 365) status = '<span class="status-badge status-ok">Stable</span>';

        // Format usage
        const usageText = item.avgDailyUsage > 0 ? `${item.avgDailyUsage} ${item.unit}/day` : 'No recent usage';
        const daysText = daysLeft > 365 ? '> 1 Year' : `${daysLeft} days`;

        html += `
            <tr>
                <td>${item.name}</td>
                <td>${item.currentStock} ${item.unit}</td>
                <td>${usageText}</td>
                <td>${daysText}</td>
                <td>${status}</td>
            </tr>
        `;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

function renderLogs(logs) {
    const list = document.getElementById('activity-log-list');
    list.innerHTML = '';

    if (logs.length === 0) {
        list.innerHTML = '<tr><td colspan="3" style="text-align:center;">No activity logged yet.</td></tr>';
        return;
    }

    logs.forEach(log => {
        const date = new Date(log.timestamp).toLocaleString();
        const row = document.createElement('tr');
        // Simple color coding for action
        let color = '#374151';
        if (log.action.includes('DELETE')) color = 'var(--danger)';
        if (log.action.includes('ADD')) color = 'var(--success)';

        row.innerHTML = `
            <td>${date}</td>
            <td style="font-weight:600; color:${color}">${log.action}</td>
            <td>${log.details}</td>
        `;
        list.appendChild(row);
    });
}

function exportToCSV() {
    fetch(`${API_URL}/items`)
        .then(res => res.json())
        .then(items => {
            const csvRows = [];
            // Header
            csvRows.push(['ID', 'Name', 'Category', 'Quantity', 'Unit', 'Min Threshold', 'Last Updated']);

            items.forEach(item => {
                csvRows.push([
                    item.id,
                    `"${item.name}"`, // Escape quotes
                    item.category,
                    item.quantity,
                    item.unit,
                    item.min_threshold,
                    item.last_updated
                ]);
            });

            const csvString = csvRows.map(e => e.join(",")).join("\n");
            const blob = new Blob([csvString], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.setAttribute('hidden', '');
            a.setAttribute('href', url);
            a.setAttribute('download', 'inventory_report.csv');
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        });
}

// Close modal when clicking outside
window.onclick = function (event) {
    const modal = document.getElementById('item-modal');
    if (event.target == modal) {
        closeModal();
    }
}
