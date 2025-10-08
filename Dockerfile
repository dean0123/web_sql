# 步驟 1: 使用 Debian-based 的 Python 映像檔作為基礎以方便安裝函式庫
FROM python:3.10-slim-bookworm

# 步驟 2: 設定 Oracle Instant Client 的環境變數
# ORACLE_CLIENT_LIB: 指定 client 解壓縮後的路徑
# LD_LIBRARY_PATH: 讓系統能找到 Oracle 的動態連結函式庫
ENV ORACLE_CLIENT_LIB=/opt/oracle/instantclient_19_28
ENV LD_LIBRARY_PATH=$ORACLE_CLIENT_LIB
# intel/amd下載x86,  mac/raspberry改下載arm64的client
#ENV ORACLE_CLIENT_URL="https://download.oracle.com/otn_software/linux/instantclient/1928000/instantclient-basic-linux.x64-19.28.0.0.0dbru.zip"
ENV ORACLE_CLIENT_URL="https://download.oracle.com/otn_software/linux/instantclient/1928000/instantclient-basic-linux.arm64-19.28.0.0.0dbru.zip"

# 設定 PROXY 給 apt, curl, wget 使用, 可設在.env 作為變數,mac/pc docker會用本機proxy可不用設
ENV HTTP_PROXY="http://10.1.229.229:15629/"
ENV HTTPS_PROXY="http://10.1.229.229:15629/"
RUN echo 'Acquire::http::Proxy "http://10.1.229.229:15629/";' > /etc/apt/apt.conf

# 步驟 3: 安裝作業系統層級的必要套件
# unzip: 用於解壓縮 instant client
# libaio1: Oracle Thick Mode 必要的相依性函式庫
# 如果 不是python:3.10-slim bookworm 版的,可能沒有 libio1, 試試看 裝 libio1t64 或是下一行link
# ln -s /lib/aarch64-linux-gnu/libaio.so.1t64.0.2 /lib/aarch64-linux-gnu/libaio.so.1

RUN apt-get update && apt-get install -y --no-install-recommends \
    wget curl \ 
    unzip \ 
    libaio1 \
    gnupg unixodbc-dev \
    && rm -rf /var/lib/apt/lists/*

# 步驟 4: 複製並解壓縮 Oracle Instant Client
# 下載 instantclient-basic-linux.x64-19.28.0.0.0dbru.zip
#      wget 有時無法用SSL/TLS, 使用curl 下載比較沒用問題.
RUN curl -k ${ORACLE_CLIENT_URL} -o /tmp/instantclient.zip && unzip /tmp/instantclient.zip -d /opt/oracle/ && \
    rm /tmp/instantclient.zip




# 步驟 4-1 : 新增 Microsoft GPG key 並設定 APT repository for MS ODBC Driver
RUN curl -fsSL https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor -o /usr/share/keyrings/microsoft-prod.gpg \
    && curl https://packages.microsoft.com/config/debian/12/prod.list > /etc/apt/sources.list.d/mssql-release.list \
    && apt-get update \
    && ACCEPT_EULA=Y apt-get install -y msodbcsql18


# 步驟 5: 設定容器內的工作目錄
WORKDIR /app

# 步驟 6: 複製套件需求檔案並安裝 Python 套件
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 步驟 7: 將您專案的所有檔案複製到工作目錄
COPY . .

# 步驟 8: 向 Docker 宣告容器將會監聽的埠號
EXPOSE 8000

# 步驟 9: 定義容器啟動時要執行的指令
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
