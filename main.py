import oracledb
#import pyodbc # <-- 新增 for SQL Server
import pyodbc 
import logging
import os
import re
from fastapi import FastAPI, HTTPException, Body
from pydantic import BaseModel, Field
from fastapi.responses import FileResponse
from typing import Optional, List, Dict, Any
from enum import Enum

# --- 1. 初始化設定 ---
logging.basicConfig(level=logging.INFO)

try:
    oracledb.init_oracle_client(lib_dir=os.environ.get("ORACLE_CLIENT_LIB"))
    logging.info(f"Oracle Thick Mode initialized successfully. Client version: {oracledb.clientversion()}")
except Exception as e:
    logging.warning(f"Could not initialize Oracle client in Thick Mode: {e}. The application will continue in Thin Mode.")

# --- 2. Pydantic 模型定義 ---

class DbType(str, Enum):
    ORACLE = "ORA"
    MSSQL = "SQL"
    POSTGRES = "POST"
    SQLITE = "LITE"

class DbConnectionBase(BaseModel):
    hostname: str
    sid: str
    user: str
    password: str = Field(..., alias="pwd")
    db_type: DbType = DbType.ORACLE
    port: Optional[int] = None
    profileId: Optional[str] = None

class SQLQuery(DbConnectionBase):
    sql: str
    max_rows: int = Field(200, gt=0, le=10000)

# --- 3. 核心邏輯與輔助函式 ---

def validate_read_only_sql(sql: str):
    """
    檢查 SQL 語句是否為唯讀查詢。
    防止執行 DML (INSERT, UPDATE, DELETE) 和 DDL (CREATE, ALTER, DROP, TRUNCATE) 操作。
    """
    # 移除 C-style 註解 /* ... */
    sql_no_comments = re.sub(r'/\*.*?\*/', '', sql, flags=re.DOTALL)
    # 移除 SQL-style 註解 -- ...
    sql_no_comments = re.sub(r'--.*', '', sql_no_comments)
    
    # 以分號分割多個語句，並過濾掉空字串
    statements = [s.strip() for s in sql_no_comments.split(';') if s.strip()]

    if not statements:
        raise HTTPException(status_code=400, detail="SQL 語句不可為空。")

    # 檢查每一個獨立的語句
    for statement in statements:
        # 取得第一個詞並轉為大寫
        first_word = statement.split()[0].upper()
        allowed_starters = ["SELECT", "WITH","USE"]
        
        if first_word not in allowed_starters:
            raise HTTPException(
                status_code=400,
                detail=f"僅允許執行唯讀查詢 (SELECT 或 WITH 開頭)。偵測到不被允許的指令 '{first_word}'。"
            )

def get_db_engine(conn_details: DbConnectionBase):
    """
    根據 db_type 建立並回傳對應的資料庫連線。
    """
    logging.info(f"Attempting to connect to {conn_details.db_type.value} database...")
    
    if conn_details.db_type == DbType.ORACLE:
        try:
            dsn = oracledb.makedsn(conn_details.hostname, conn_details.port or 1521, sid=conn_details.sid)
            logging.info(f"Connecting to Oracle with DSN: {dsn}")
            return oracledb.connect(user=conn_details.user, password=conn_details.password, dsn=dsn)
        except oracledb.Error as e:
            logging.error(f"Oracle connection failed: {e}")
            raise HTTPException(status_code=400, detail=f"Oracle 連線失敗: {e} \n檢查 Oracle Thick CLient 設定")
    
    # --- 未來擴充點 ---
    # ====================== 【Add SQL Server 修改開始】 ======================
    elif conn_details.db_type == DbType.MSSQL:
        try:
            # {ODBC Driver 18 for SQL Server} 是我們將在 Dockerfile 中安裝的驅動程式名稱
            driver = "{ODBC Driver 18 for SQL Server}"
            server = f"{conn_details.hostname},{conn_details.port or 1433}"
            # 對於 SQL Server，前端傳來的 'sid' 欄位對應的是 'DATABASE'
            database = conn_details.sid
            username = conn_details.user
            password = conn_details.password
            # 組合 pyodbc 連線字串
            conn_str = f"DRIVER={driver};SERVER={server};DATABASE={database};UID={username};PWD={password};Encrypt=yes;TrustServerCertificate=yes"
            logging.info("Connecting to MS-SQL Server...")
            return pyodbc.connect(conn_str)
        except pyodbc.Error as e:
            logging.error(f"MS-SQL Server connection failed: {e}")
            # 回傳一個前端可以理解的詳細錯誤訊息
            raise HTTPException(status_code=400, detail=f"MS-SQL Server 連線失敗: {e}")
    # ====================== 【修改結束】 ======================
        raise HTTPException(status_code=501, detail="MS-SQL Server 連線功能尚未實作")
    elif conn_details.db_type == DbType.POSTGRES:
        raise HTTPException(status_code=501, detail="PostgreSQL 連線功能尚未實作")
    elif conn_details.db_type == DbType.SQLITE:
        raise HTTPException(status_code=501, detail="SQLite 連線功能尚未實作")
    else:
        raise HTTPException(status_code=400, detail="不支援的資料庫類型")


# --- 4. FastAPI 應用程式實例 ---
app = FastAPI(
    title="DB Web Query Tool API",
    description="一個純粹的資料庫查詢代理 API，不處理任何設定檔儲存。"
)

# --- 5. API Endpoints ---

@app.post("/test-connection", tags=["Database"])
async def test_db_connection(conn_details: DbConnectionBase = Body(...)):
    """
    測試與指定資料庫的連線。
    """
    try:
        with get_db_engine(conn_details):
            pass
        return {"status": "success", "message": f"{conn_details.db_type.value} DB {conn_details.hostname} 連線成功！"}
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"發生未預期的連線錯誤: {e}")

@app.post("/execute-query", tags=["Database"])
async def execute_sql_query(query: SQLQuery = Body(...)):
    """
    在指定的資料庫上執行 SQL 查詢，並包含安全檢查。
    """
    # 【安全檢查】在執行任何操作前，先驗證 SQL 語句
    validate_read_only_sql(query.sql)
    
    try:
        with get_db_engine(query) as connection:
            with connection.cursor() as cursor:
                cursor.execute(query.sql)
                columns = [col[0] for col in cursor.description] if cursor.description else []
                rows = cursor.fetchmany(query.max_rows)
                result_data = [dict(zip(columns, row)) for row in rows]
                return {
                    "status": "success",
                    "row_count": len(result_data),
                    "columns": columns,
                    "data": result_data,
                }
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"查詢執行失敗: {e}")

# --- 6. 前端靜態檔案服務 ---
@app.get("/", include_in_schema=False)
async def read_index():
    """
    提供前端 index.html 頁面。
    """
    return FileResponse('index.html')


@app.get("/login", include_in_schema=False)
async def login():
    return FileResponse('login.html')

@app.get("/login_auto", include_in_schema=False)
async def login():
    return FileResponse('login_auto.html')
