from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
import os

from . import models, database, auth, schemas
from .database import engine
from .routers import auth as auth_router, articles as articles_router, upload as upload_router, drafts as drafts_router

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
app.include_router(drafts_router.router)

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
    return {
        "status": "SUCCESS", 
        "id": current_user.id,
        "username": current_user.username, 
        "role": current_user.role,
        "nickname": current_user.nickname,
        "avatar": current_user.avatar,
        "birthday": current_user.birthday,
        "is_profile_completed": current_user.is_profile_completed
    }

@app.put("/api/users/profile")
def update_user_profile(
    profile: schemas.UserProfileUpdate, 
    db: Session = Depends(database.get_db), 
    current_user: models.User = Depends(auth.get_current_user)
):
    """ 更新自我绝密资料。一旦锁定，破防出关 """
    # 护甲验证：昵称不得重复抢注（排除自身当前昵称）
    existing_user = db.query(models.User).filter(models.User.nickname == profile.nickname, models.User.id != current_user.id).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="宇宙法则：此代号已被其他使者获取，请更名。")
    
    current_user.nickname = profile.nickname
    current_user.birthday = profile.birthday
    if profile.avatar:
        current_user.avatar = profile.avatar
    # 强制将状态提拔为完善，摧毁拦截锁死！
    current_user.is_profile_completed = True
    
    db.commit()
    db.refresh(current_user)
    return {"status": "SUCCESS", "detail": "铭牌注入圆满完成，系统全面解禁。"}

@app.get("/api/admin/dashboard")
def read_admin_data(current_user: models.User = Depends(auth.get_current_admin)):
    """ [Admin / 管理员专属] JWT 必须有效且角色标定为 Admin 才能查看 """
    return {"status": "SUCCESS", "message": "High Secret Board for Admins."}
