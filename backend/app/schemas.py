from pydantic import BaseModel, ConfigDict
from typing import Optional
from pydantic import BaseModel, ConfigDict
from typing import Optional
from .models import RoleEnum, CategoryEnum, VisibilityEnum

class UserCreate(BaseModel):
    username: str
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class UserOut(BaseModel):
    id: int
    username: str
    role: RoleEnum
    is_active: bool

    model_config = ConfigDict(from_attributes=True)

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class ArticleBase(BaseModel):
    title: str
    content: str
    category: CategoryEnum = CategoryEnum.knowledge
    visibility: VisibilityEnum = VisibilityEnum.public

class ArticleCreate(ArticleBase):
    pass

class ArticleOut(ArticleBase):
    id: int
    author_id: int
    model_config = ConfigDict(from_attributes=True)
