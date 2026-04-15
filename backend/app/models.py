from sqlalchemy import Boolean, Column, Integer, String, Text, Enum, ForeignKey, UniqueConstraint
import enum
import secrets
from datetime import datetime
from .database import Base

def get_current_time():
    return datetime.now().strftime("%Y-%m-%d %H:%M")

def generate_nano_id():
    return secrets.token_urlsafe(8)

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
    solution = "solution"        # 题解隐脉（不在任何常规列表展示）

# ============ 实体映射 ORM ============
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(Enum(RoleEnum), default=RoleEnum.user, nullable=False)
    nickname = Column(String, unique=True, nullable=True)     # 用户昵称，确保不发生重名
    avatar = Column(String, nullable=True)                    # 头像，默认会使用昵称截取的单字符投射展示
    birthday = Column(String, nullable=True)                  # 出生时间刻度线
    is_profile_completed = Column(Boolean, default=False)     # 核心拦截属性标点
    is_active = Column(Boolean, default=True)

class Article(Base):
    __tablename__ = "articles"

    id = Column(String(16), primary_key=True, index=True, default=generate_nano_id)
    title = Column(String, index=True, nullable=False)
    content = Column(Text, nullable=False)
    category = Column(Enum(CategoryEnum), default=CategoryEnum.knowledge, nullable=False)
    visibility = Column(Enum(VisibilityEnum), default=VisibilityEnum.public, nullable=False)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    code_template = Column(Text, nullable=True)
    tags = Column(String, default="")
    views_count = Column(Integer, default=0)
    comments_count = Column(Integer, default=0)
    created_at = Column(String, default=get_current_time)

class Comment(Base):
    __tablename__ = "comments"

    id = Column(String(16), primary_key=True, index=True, default=generate_nano_id)
    content = Column(Text, nullable=False)
    article_id = Column(String(16), ForeignKey("articles.id"), nullable=False)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(String, default=get_current_time)
    parent_id = Column(String(16), ForeignKey("comments.id"), nullable=True)
    likes_count = Column(Integer, default=0)

class CommentLike(Base):
    __tablename__ = "comment_likes"

    id = Column(Integer, primary_key=True, index=True)
    comment_id = Column(String(16), ForeignKey("comments.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

class SolutionMapping(Base):
    __tablename__ = "solution_mappings"

    id = Column(String(16), primary_key=True, index=True, default=generate_nano_id)
    question_id = Column(String(16), ForeignKey("articles.id"), nullable=False)  # 题目载体
    solution_id = Column(String(16), ForeignKey("articles.id"), nullable=False)  # 题解本身（通过此ID也可完全复用 Article 及评论体系）
    created_at = Column(String, default=get_current_time)

class Draft(Base):
    __tablename__ = "drafts"

    id = Column(String(16), primary_key=True, index=True, default=generate_nano_id)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    category = Column(Enum(CategoryEnum), nullable=False)
    target_id = Column(String(16), nullable=True) # Used to bind code/solution to a specific question article id
    title = Column(String, default="")
    content = Column(Text, default="")
    code_template = Column(Text, nullable=True)
    tags = Column(String, default="")
    created_at = Column(String, default=get_current_time)
    updated_at = Column(String, default=get_current_time)

class ImageAsset(Base):
    __tablename__ = "image_assets"

    id = Column(Integer, primary_key=True, index=True)
    hash = Column(String(64), index=True, nullable=False)
    filename = Column(String, unique=True, index=True, nullable=False)
    url = Column(String, unique=True, nullable=False)
    mime = Column(String, nullable=False)
    size = Column(Integer, nullable=False)
    uploader_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(String, default=get_current_time)

class ImageReference(Base):
    __tablename__ = "image_references"
    __table_args__ = (
        UniqueConstraint("image_id", "owner_type", "owner_id", "field", name="uq_image_reference_owner"),
    )

    id = Column(Integer, primary_key=True, index=True)
    image_id = Column(Integer, ForeignKey("image_assets.id", ondelete="CASCADE"), nullable=False, index=True)
    owner_type = Column(String, nullable=False, index=True)
    owner_id = Column(String(32), nullable=False, index=True)
    field = Column(String, default="content", nullable=False)
    created_at = Column(String, default=get_current_time)
