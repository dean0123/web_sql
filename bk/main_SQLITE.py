import oracledb
import sqlite3
import logging
import os
from fastapi import FastAPI, HTTPException, Body
from pydantic import BaseModel, Field
from fastapi.responses import FileResponse
from contextlib import contextmanager
from typing import Optional

# --- 初始化設定 ---
logging.basicConfig(level=logging.INFO)

try:
    oracledb.init_oracle_client(lib_dir=os.environ.get("ORACLE_CLIENT_LIB"))
    logging.info(f"Oracle Thick Mode initialized successfully. Client version: {oracledb.clientversion()}")
except Exception as e:
    logging.error(f"Error initializing Oracle client: {e}")

DB_DIR = "data"
DB_PATH = os.path.join(DB_DIR, "profiles.db")

# --- 資料庫輔助函式 ---
def init_db():
    os.makedirs(DB_DIR, exist_ok=True)
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        # 建立連線設定檔資料表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS profiles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                hostname TEXT NOT NULL,
                sid TEXT NOT NULL,
                user TEXT NOT NULL,
                password TEXT NOT NULL
            )
        """)
        # 建立 SQL 語句資料表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sql_statements (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                profile_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                statement TEXT NOT NULL,
                FOREIGN KEY (profile_id) REFERENCES profiles (id) ON DELETE CASCADE,
                UNIQUE (profile_id, name)
            )
        """)
        conn.commit()
        logging.info("SQLite database and tables initialized.")

@contextmanager
def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

# --- Pydantic 模型定義 ---
class OracleConnection(BaseModel):
    hostname: str = Field(...)
    sid: str = Field(...)
    user: str = Field(...)
    password: str = Field(..., alias="pwd")

class SQLQuery(OracleConnection):
    sql: str = Field(...)
    max_rows: int = Field(200, gt=0, le=10000)

class ProfileBase(BaseModel):
    hostname: str
    sid: str
    user: str
    password: str

class ProfileCreate(ProfileBase):
    name: str

class Profile(ProfileBase):
    id: int
    name: str

class SQLStatementBase(BaseModel):
    name: str
    statement: str

class SQLStatementCreate(SQLStatementBase):
    profile_id: int

class SQLStatement(SQLStatementBase):
    id: int
    profile_id: int


# --- FastAPI 應用程式實例 ---
app = FastAPI(title="DB Web Query Tool API")

@app.on_event("startup")
async def startup_event():
    init_db()

# --- API Endpoints ---

# --- Profile CRUD ---
@app.post("/profiles", response_model=Profile, tags=["Profiles"])
async def create_profile(profile: ProfileCreate):
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO profiles (name, hostname, sid, user, password) VALUES (?, ?, ?, ?, ?)",
                (profile.name, profile.hostname, profile.sid, profile.user, profile.password)
            )
            conn.commit()
            profile_id = cursor.lastrowid
            return {**profile.dict(), "id": profile_id}
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="此設定檔名稱已存在")

@app.get("/profiles", response_model=list[Profile], tags=["Profiles"])
async def get_all_profiles():
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, hostname, sid, user, password FROM profiles ORDER BY name")
        return [dict(row) for row in cursor.fetchall()]

@app.put("/profiles/{profile_id}", response_model=Profile, tags=["Profiles"])
async def update_profile(profile_id: int, profile: ProfileCreate):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM profiles WHERE id = ?", (profile_id,))
        if cursor.fetchone() is None:
            raise HTTPException(status_code=404, detail="找不到指定的設定檔")
        try:
            cursor.execute(
                "UPDATE profiles SET name = ?, hostname = ?, sid = ?, user = ?, password = ? WHERE id = ?",
                (profile.name, profile.hostname, profile.sid, profile.user, profile.password, profile_id)
            )
            conn.commit()
            return {"id": profile_id, **profile.dict()}
        except sqlite3.IntegrityError:
            raise HTTPException(status_code=400, detail="此設定檔名稱已存在")

@app.delete("/profiles/{profile_id}", tags=["Profiles"])
async def delete_profile(profile_id: int):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM profiles WHERE id = ?", (profile_id,))
        conn.commit()
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="找不到指定的設定檔")
        return {"status": "success", "message": "設定檔已刪除"}

# --- SQL Statement CRUD ---
@app.post("/sqls", response_model=SQLStatement, tags=["SQL Statements"])
async def create_sql_statement(stmt: SQLStatementCreate):
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO sql_statements (profile_id, name, statement) VALUES (?, ?, ?)",
                (stmt.profile_id, stmt.name, stmt.statement)
            )
            conn.commit()
            stmt_id = cursor.lastrowid
            return {**stmt.dict(), "id": stmt_id}
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail=f"此設定檔下已有名為 '{stmt.name}' 的 SQL")

@app.get("/profiles/{profile_id}/sqls", response_model=list[SQLStatement], tags=["SQL Statements"])
async def get_sqls_for_profile(profile_id: int):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, profile_id, name, statement FROM sql_statements WHERE profile_id = ? ORDER BY name", (profile_id,))
        return [dict(row) for row in cursor.fetchall()]

@app.put("/sqls/{sql_id}", response_model=SQLStatement, tags=["SQL Statements"])
async def update_sql_statement(sql_id: int, stmt: SQLStatementBase):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        # 取得 profile_id 以便回傳
        cursor.execute("SELECT profile_id FROM sql_statements WHERE id = ?", (sql_id,))
        row = cursor.fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="找不到指定的 SQL")
        profile_id = row['profile_id']
        try:
            cursor.execute(
                "UPDATE sql_statements SET name = ?, statement = ? WHERE id = ?",
                (stmt.name, stmt.statement, sql_id)
            )
            conn.commit()
            return {"id": sql_id, "profile_id": profile_id, **stmt.dict()}
        except sqlite3.IntegrityError:
            raise HTTPException(status_code=400, detail=f"此設定檔下已有名為 '{stmt.name}' 的 SQL")

@app.delete("/sqls/{sql_id}", tags=["SQL Statements"])
async def delete_sql_statement(sql_id: int):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM sql_statements WHERE id = ?", (sql_id,))
        conn.commit()
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="找不到指定的 SQL")
        return {"status": "success", "message": "SQL 語句已刪除"}


# --- Oracle Operations ---
@app.post("/test-connection", tags=["Database"])
async def test_oracle_connection(conn: OracleConnection = Body(...)):
    dsn = f"{conn.hostname}/{conn.sid}"
    try:
        with oracledb.connect(user=conn.user, password=conn.password, dsn=dsn):
            pass
        return {"status": "success", "message": f"Oracle DB (Thick Mode) {conn.hostname}/{conn.sid} 連線成功！"}
    except oracledb.Error as e:
        raise HTTPException(status_code=400, detail=f"連線失敗: {e}")

@app.post("/execute-query", tags=["Database"])
async def execute_sql_query(query: SQLQuery = Body(...)):
    dsn = f"{query.hostname}/{query.sid}"
    try:
        with oracledb.connect(user=query.user, password=query.password, dsn=dsn) as connection:
            with connection.cursor() as cursor:
                cursor.execute(query.sql)
                columns = [col[0] for col in cursor.description] if cursor.description else []
                # 使用 fetchmany 限制回傳的行數
                rows = cursor.fetchmany(query.max_rows)
                result_data = [dict(zip(columns, row)) for row in rows]
                return {
                    "status": "success",
                    "row_count": len(result_data),
                    "columns": columns,
                    "data": result_data,
                }
    except oracledb.Error as e:
        raise HTTPException(status_code=400, detail=f"查詢執行失敗: {e}")

# --- Frontend Hosting ---
@app.get("/", include_in_schema=False)
async def read_index():
    return FileResponse('index.html')


