from sqlalchemy import Boolean, Column, Integer, String, Text, Enum, ForeignKey
import enum
from .database import Base

# ============ 枚举类定义 ============
class RoleEnum(str, enum.Enum):
    user = "user"    # 普通用户
    admin = "admin"  # 管理员

class VisibilityEnum(str, enum.Enum):
    public = "public"            # 游客可见 (未加密文章)
    registered = "registered"    # 注册用户可见 (加密)
    admin_only = "admin_only"    # 管理员可见 (比如隐藏文章/草稿)

class CategoryEnum(str, enum.Enum):
    knowledge = "knowledge"      # 知识板块
    interview = "interview"      # 面经板块
    code = "code"                # 代码板块

# ============ 实体映射 ORM ============
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(Enum(RoleEnum), default=RoleEnum.user, nullable=False)
    is_active = Column(Boolean, default=True)

class Article(Base):
    __tablename__ = "articles"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True, nullable=False)
    content = Column(Text, nullable=False)
    category = Column(Enum(CategoryEnum), default=CategoryEnum.knowledge, nullable=False)
    visibility = Column(Enum(VisibilityEnum), default=VisibilityEnum.public, nullable=False)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
