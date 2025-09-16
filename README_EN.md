# DB Web SQL Tool - Project Documentation

## Project Overview

This is a web-based SQL query tool designed to provide a convenient, cross-platform interface for users to connect to various databases (such as Oracle) and execute **read-only** SQL queries.

This tool adopts a front-end/back-end separated architecture:

-   **Frontend**: A feature-rich Single Page Application (`index.html`) that handles all UI interactions. It moves the complex management of connection profiles and SQL statements entirely to the browser's `localStorage`, allowing user settings to be easily persisted locally.

-   **Backend**: A lightweight and secure FastAPI proxy service (`main.py`) that focuses on receiving requests from the frontend, establishing database connections, executing SQL queries, and returning the results.

---

## Core Features

### 1. Connection Profile Management (Frontend `localStorage`)

-   **CRUD Operations**: Provides complete lifecycle management for connection profiles.
-   **Smart Save**: An integrated "Save" button allows creating or overwriting profiles by simply entering different names.
-   **Auto-Memory**: Automatically loads the last used connection profile upon page reload.
-   **Multi-Database Support**: Supports configuration for DB Type (Oracle, MS-SQL, etc.) and corresponding ports.
-   **Automatic Sorting**: Profiles in the dropdown menu are sorted alphabetically.

### 2. SQL Statement Management (Frontend `localStorage`)

-   **Profile Association**: Each SQL statement is tied to a connection profile for easy management.
-   **Smart Save**: Uses the same integrated "Save" button for both creating and updating SQL statements.
-   **Automatic Sorting**: SQL statements in the dropdown menu are also sorted alphabetically.

### 3. Dual Query Execution Modes

-   **In-Page Query**: Executes queries via AJAX on the current page and updates the results, ideal for quick validation and iterative querying.
-   **New Request Query**: Executes queries in a new page request while preserving the state of the current page. This allows for easy review of multiple query histories using the browser's back and forward buttons.

### 4. Rich Result Presentation

-   **Multiple Formats**: Supports switching between `Row Set`, `DataTables`, `HTML Table`, and `JSON` formats.
-   **Row Set Cycle Toggle**: In Row Set mode, users can cycle through "Normal → With ID → Transposed" display states.
-   **DataTables Integration**: Provides an interactive table with client-side sorting and searching capabilities. The default initial sorting has been disabled to preserve the original data order.
-   **CSV Export**: Allows exporting the current query result (including ID and transposed data) to a CSV file.

### 5. User Experience (UX) Optimizations

-   **Secure Parameter Passing**: For "New Request" queries, connection parameters are passed via `sessionStorage`, keeping sensitive information out of the URL.
-   **Query Response Time**: Displays the time taken for each query, with color-coding for performance indication.
-   **Local Storage Usage**: Shows real-time usage of `localStorage`.
-   **Clear/Restore**: A single button to clear the SQL input area, and a second click restores the last executed SQL.
-   **Auto-Scroll**: Automatically scrolls to the results area after a query is executed.
-   **Layout Stability**: The result container has a minimum height to prevent page layout shifts when switching formats.
-   **History Caching**: When using the browser's back/forward buttons, cached results from `sessionStorage` are displayed to avoid redundant queries.

---

## File Structure
```
/project-root  
├── .gitignore          # Git ignore list  
├── Dockerfile          # Dockerfile for building the backend service image  
├── docker-compose.yml  # Docker Compose configuration for easy startup  
├── index.html          # The frontend Single Page Application (SPA)  
├── main.py             # The backend FastAPI application  
└── requirements.txt    # Python dependency list  
```
---

## Installation and Startup (Docker Recommended)
Using Docker is the recommended way to deploy this project, as it eliminates the need to manually install Python or the Oracle Client on your local machine.

### Prerequisites
1.  Install [Git](https://git-scm.com/)
2.  Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) (which includes Docker Compose)

### Startup Steps
1.  **Clone the Project**
    Open your terminal (or Command Prompt) and use git to clone the project to your computer:
    ```bash
    git clone [Your Project's Git Repository URL]
    cd [project-directory]
    ```

2.  **Build and Start the Service**
    In the project's root directory, run the Docker Compose command. The `--build` flag ensures that Docker rebuilds the image using the latest `Dockerfile`.
    ```bash
    docker-compose up --build -d
    ```
    - The `-d` flag runs the service in detached mode (in the background).
    - The first time you build the image, it will automatically download the Oracle Client, which may take a few minutes.

3.  **Start Using**
    Once the service starts successfully, open your browser and navigate to the following URL:
    [http://localhost:8000](http://localhost:8000)

4.  **View Service Logs**
    If you need to check the logs of the backend service, you can run:
    ```bash
    docker-compose logs -f
    ```

5.  **Stop the Service**
    To stop the service, run the following command in the same project directory:
    ```bash
    docker-compose down
    ```
