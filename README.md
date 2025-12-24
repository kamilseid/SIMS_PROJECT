# Smart Inventory Management System (SIMS)

A lightweight, web-based inventory management application designed for small businesses, labs, and departments.

## 🚀 Features
- **Dashboard**: Real-time overview of total items and low-stock alerts.
- **Inventory Management**: Add, edit, and delete items with categorization and unit tracking.
- **Low-Stock Alerts**: Visual warnings when items fall below their minimum threshold.
- **Usage Trends**: Automated estimation of reliable stock duration.
- **Search & Filter**: Quickly find items by name or category.
- **Reports**: Export inventory data to CSV for external analysis.

## 🛠️ Technology Stack
- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Backend**: Node.js + Express
- **Database**: SQLite (Zero-configuration, serverless SQL database)

---

## 📥 Installation Guide

### Prerequisites
- [Node.js](https://nodejs.org/) installed on your machine.

### Setup Instructions
1. **Unzip/Clone the Project**:
   Ensure you have the project folder `SIMS PROJECT` extracted.

2. **Open Command Line**:
   - Open Command Prompt (`cmd`) or PowerShell.
   - Navigate to the project directory:
     ```bash
     cd "path/to/SIMS PROJECT"
     ```

3. **Install Dependencies**:
   Run the following command to install the necessary libraries (`express`, `sqlite3`, etc.):
   ```bash
   npm install
   ```

### 👤 Login Credentials
The system comes with a default admin account:
- **Username**: `admin`
- **Password**: `admin123`

### ▶️ Running the Application
1. **Start the Server**:
   Run the startup command:
   ```bash
   node server.js
   ```
   *(You should see a message: "Server running on http://localhost:3000")*

2. **Access the App**:
   - Open your web browser (Chrome, Edge, etc.).
   - Go to: **[http://localhost:3000](http://localhost:3000)**

---

## 📂 Project Structure
- `server.js`: The backend server that handles API requests and database connections.
- `public/`: Contains all frontend files (HTML, CSS, JS).
  - `index.html`: The main user interface.
  - `style.css`: Application styling.
  - `app.js`: Frontend logic and API integration.
- `inventory.db`: The SQLite database file (automatically created on first run).
- `package.json`: Project dependencies and configuration.

## ⚠️ Troubleshooting
- **"npm install" fails**: If you see errors about protocols/permissions, ensure you are running the command prompt as a standard user (or check internet connection).
- **Server Connection Refused**: Ensure no other application is using port 3000.
