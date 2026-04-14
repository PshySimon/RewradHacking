from pydantic import BaseModel, ConfigDict
from typing import Optional
from pydantic import BaseModel, ConfigDict
from typing import Optional
from .models import RoleEnum, CategoryEnum, VisibilityEnum

class UserCreate(BaseModel):
    username: str
    password: str

class AdminSetupCreate(UserCreate):
    nickname: str
    birthday: str

class UserLogin(BaseModel):
    username: str
    password: str

class UserOut(BaseModel):
    id: int
    username: str
    role: RoleEnum
    nickname: Optional[str] = None
    avatar: Optional[str] = None
    birthday: Optional[str] = None
    is_profile_completed: bool
    is_active: bool

    model_config = ConfigDict(from_attributes=True)

class Token(BaseModel):
    access_token: str
    token_type: str

class UserProfileUpdate(BaseModel):
    nickname: str
    birthday: str
    # 暂不开放直接传照片，优先启用动态投射截取方案，亦可预留字段
    avatar: Optional[str] = None

class TokenData(BaseModel):
    username: Optional[str] = None

class ArticleBase(BaseModel):
    title: str
    content: str
    category: CategoryEnum = CategoryEnum.knowledge
    visibility: VisibilityEnum = VisibilityEnum.public
    tags: str = ""

class ArticleCreate(ArticleBase):
    pass

class ArticleOut(ArticleBase):
    id: str
    author_id: int
    views_count: int = 0
    comments_count: int = 0
    created_at: str = ""
    author_name: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class CommentBase(BaseModel):
    content: str
    article_id: str

class CommentCreate(CommentBase):
    parent_id: Optional[str] = None

class CommentOut(CommentBase):
    id: str
    author_id: int
    created_at: str
    parent_id: Optional[str] = None
    likes_count: int = 0
    # 精英数据流：用于彻底解决前端身份认同危机
    author_username: str = ""
    author_nickname: Optional[str] = None
    author_avatar: Optional[str] = None
    author_role: str = ""
    is_liked: bool = False
    
    model_config = ConfigDict(from_attributes=True)

class DraftCreate(BaseModel):
    category: CategoryEnum
    target_id: Optional[str] = None
    title: Optional[str] = ""
    content: Optional[str] = ""
    tags: Optional[str] = ""

class DraftOut(BaseModel):
    id: str
    user_id: int
    category: CategoryEnum
    target_id: Optional[str]
    title: str
    content: str
    tags: str
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True
