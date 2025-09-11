import oracledb
import logging
import os
from fastapi import FastAPI, HTTPException, Body
from pydantic import BaseModel, Field
from fastapi.responses import FileResponse
from typing import Optional, List, Dict, Any
from enum import Enum

# --- 1. 初始化設定 ---
logging.basicConfig(level=logging.INFO)

# 嘗試初始化 Oracle Client。如果失敗，則僅記錄警告，應用程式仍可以 Thin Mode 運行
try:
    # 注意：在 Docker 環境中，ORACLE_CLIENT_LIB 環境變數由 Dockerfile 設定
    oracledb.init_oracle_client(lib_dir=os.environ.get("ORACLE_CLIENT_LIB"))
    logging.info(f"Oracle Thick Mode initialized successfully. Client version: {oracledb.clientversion()}")
except Exception as e:
    logging.warning(f"Could not initialize Oracle client in Thick Mode: {e}. The application will continue in Thin Mode.")

# --- 2. Pydantic 模型定義 ---

# 定義支援的資料庫類型 Enum，與前端保持一致
class DbType(str, Enum):
    ORACLE = "ORA"
    MSSQL = "SQL"
    POSTGRES = "POST"
    SQLITE = "LITE"

# 定義連線資訊的基本模型
class DbConnectionBase(BaseModel):
    hostname: str
    sid: str # 對於不同DB，可能代表 Service Name, Database Name 等
    user: str
    password: str = Field(..., alias="pwd")
    db_type: DbType = DbType.ORACLE
    port: Optional[int] = None
    # profileId 從前端傳來，但後端不再需要處理它，因此設為可選
    profileId: Optional[str] = None


# 定義 SQL 查詢請求的模型，繼承自連線模型:
class SQLQuery(DbConnectionBase):
    sql: str
    max_rows: int = Field(200, gt=0, le=10000)

# --- 3. 多資料庫連線邏輯 ---

def get_db_engine(conn_details: DbConnectionBase):
    """
    根據 db_type 建立並回傳對應的資料庫連線。
    這是一個擴充點，未來可以加入對其他資料庫的支援。
    """
    logging.info(f"Attempting to connect to {conn_details.db_type.value} database...")
    
    if conn_details.db_type == DbType.ORACLE:
        try:
            # 使用 oracledb.makedsn 可以更好地處理 Thick/Thin mode 的差異
            dsn = oracledb.makedsn(conn_details.hostname, conn_details.port or 1521, sid=conn_details.sid)
            logging.info(f"Connecting to Oracle with DSN: {dsn}")
            return oracledb.connect(user=conn_details.user, password=conn_details.password, dsn=dsn)
        except oracledb.Error as e:
            logging.error(f"Oracle connection failed: {e}")
            raise HTTPException(status_code=400, detail=f"Oracle 連線失敗: {e}")
    
    # --- 未來擴充點 ---
    elif conn_details.db_type == DbType.MSSQL:
        # 這裡可以加入 pyodbc 的連線邏輯
        raise HTTPException(status_code=501, detail="MS-SQL Server 連線功能尚未實作")
    elif conn_details.db_type == DbType.POSTGRES:
        # 這裡可以加入 psycopg2 的連線邏輯
        raise HTTPException(status_code=501, detail="PostgreSQL 連線功能尚未實作")
    elif conn_details.db_type == DbType.SQLITE:
        # SQLite 是檔案型資料庫，連線邏輯不同
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
        # 使用 with 語句確保連線在使用後會被自動關閉
        with get_db_engine(conn_details):
            pass
        return {"status": "success", "message": f"{conn_details.db_type.value} DB {conn_details.hostname} 連線成功！"}
    except HTTPException as e:
        # 如果 get_db_engine 內部拋出 HTTPException，直接重新拋出
        raise e
    except Exception as e:
        # 捕獲其他未預期的錯誤
        raise HTTPException(status_code=500, detail=f"發生未預期的連線錯誤: {e}")

@app.post("/execute-query", tags=["Database"])
async def execute_sql_query(query: SQLQuery = Body(...)):
    """
    在指定的資料庫上執行 SQL 查詢。
    """
    try:
        with get_db_engine(query) as connection:
            with connection.cursor() as cursor:
                cursor.execute(query.sql)
                # 安全地獲取欄位名稱
                columns = [col[0] for col in cursor.description] if cursor.description else []
                # 使用 fetchmany 限制回傳的行數
                rows = cursor.fetchmany(query.max_rows)
                # 將結果轉換為 [ {column: value}, ... ] 的格式
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

