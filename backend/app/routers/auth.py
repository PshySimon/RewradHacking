from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordRequestForm
from typing import Any

from .. import schemas, database, models, auth

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

@router.post("/register", response_model=schemas.UserOut)
def register_user(user: schemas.UserCreate, db: Session = Depends(database.get_db)) -> Any:
    # 防重名校验
    db_user = db.query(models.User).filter(models.User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="该用户名已被注册")
        
    hashed_pwd = auth.get_password_hash(user.password)
    # 所有从公开接口进来的新注册人员，强制给予 User 角色
    new_user = models.User(
        username=user.username,
        hashed_password=hashed_pwd,
        role=models.RoleEnum.user
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.post("/login", response_model=schemas.Token)
def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(), 
    db: Session = Depends(database.get_db)
) -> Any:
    # 查找并核对密码使用 bcrypt 算法
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或者密码错误",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # 颁布令牌凭证
    access_token_expires = auth.timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.username, "role": user.role}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/setup_admin", response_model=schemas.UserOut)
def setup_admin(user: schemas.UserCreate, db: Session = Depends(database.get_db)) -> Any:
    """ 系统的根源安装器：只允许存活并在整个数据库没有管理员时被调用一次 """
    # 终极一键锁死安全网
    admin_exists = db.query(models.User).filter(models.User.role == models.RoleEnum.admin).first()
    if admin_exists:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="非法操作拦截：本系统已经存在系统级领导者并已深度锁定安装大门。"
        )
    
    # 查重防止意外异常撞名
    db_user = db.query(models.User).filter(models.User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="该超管名目前甚至被一个普通游客先注册了，请高规格一点换一个名字！")
        
    hashed_pwd = auth.get_password_hash(user.password)
    # 为此账号赋能超管光环
    new_admin = models.User(
        username=user.username,
        hashed_password=hashed_pwd,
        role=models.RoleEnum.admin
    )
    db.add(new_admin)
    db.commit()
    db.refresh(new_admin)
    return new_admin
