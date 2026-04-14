import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# 绝对锚定，防止任何工作空间启动脚本导致的路径乱飞
DB_PATH = os.path.join(os.path.dirname(BASE_DIR), "hacking.db")
SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH}"

# 创建数据库引擎
# check_same_thread 设定是为了适配 SQLite 本地多线程通信
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 实体继承的基础类
Base = declarative_base()

# 数据库连接生成器 (依赖注入)
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
