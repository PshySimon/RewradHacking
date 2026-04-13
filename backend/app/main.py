from fastapi import FastAPI, Depends
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
import os

from . import models, database, auth
from .database import engine
from .routers import auth as auth_router, articles as articles_router, upload as upload_router

# 创建所有数据库表
models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Interview Platform Core API",
    description="纯享版后台网关，已将视图控制完全剥离移交 React 处理。",
    version="1.0"
)

# 聚合认证与其他子路由
app.include_router(auth_router.router)
app.include_router(articles_router.router)
app.include_router(upload_router.router)

# 设置安全大后方的反向穿透，利用 /api/static/images 访问物理沙盒
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data/uploads")
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR, exist_ok=True)
# 注意：前端会请求 proxy /api/static/images -> 将被代理到后端的这个挂载点！
app.mount("/api/static/images", StaticFiles(directory=UPLOAD_DIR), name="static_images")

# ======== 核心纯数据演示路由 ========

@app.get("/api/system/status")
def read_system_status(db: Session = Depends(database.get_db)):
    """ 
    基础状态检测探针。
    前台将会通过代理探测是否要求强制进入 /setup 初始化大门。
    """
    master_exists = db.query(models.User).filter(models.User.role == models.RoleEnum.admin).first()
    return {
        "status": "UP", 
        "needs_initialization": not bool(master_exists)
    }

@app.get("/api/users/me")
def read_users_me(current_user: models.User = Depends(auth.get_current_user)):
    """ [User / 注册用户专属] 携带有效 JWT 才能访问 """
    return {"status": "SUCCESS", "username": current_user.username, "role": current_user.role}

@app.get("/api/admin/dashboard")
def read_admin_data(current_user: models.User = Depends(auth.get_current_admin)):
    """ [Admin / 管理员专属] JWT 必须有效且角色标定为 Admin 才能查看 """
    return {"status": "SUCCESS", "message": "High Secret Board for Admins."}
