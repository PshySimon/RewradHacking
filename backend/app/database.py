from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

SQLALCHEMY_DATABASE_URL = "sqlite:///./interview.db"

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
