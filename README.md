
1. set PROXY if need
```
 $ export HTTP_PROXY="http://10.1.229.229:15629/";export HTTPS_PROXY=$HTTP_PROXY
```

2. `docker compose build`
   - Build Image
   - 會依照 docker-compose.yml 裡面指定的 一個或多個路徑, 去找 Dockerfile 然後 build出 一個或多個 images , 此時只有 images, 還沒有 容器. 也沒有啟動.
   -  用 docker images 檢查新build 出來的 image 
3. `docker compse up`
   - 啟動容器 Container
   - 依照 docker-compose.yam 的指示, 用不同的image 啟動不同的容器
   - 用 docker ps -a 看容器狀態

4. `docker compose down`
   - 下容器 移除容器 
   - 下容器 移除容器 移除Image 還有其他
   `docker compose down -v --rmi all --remove-orphans`
   - 如果是Control-C 中斷, 容器會還在
    