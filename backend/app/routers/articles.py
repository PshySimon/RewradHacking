from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Any
import os

from .. import schemas, database, models, auth

router = APIRouter(prefix="/api/articles", tags=["Articles"])

@router.get("/", response_model=List[schemas.ArticleOut])
def read_articles(
    category: models.CategoryEnum = None, 
    skip: int = 0, limit: int = 100, 
    db: Session = Depends(database.get_db)
) -> Any:
    """ 拉取对应分类的文章广场 """
    query = db.query(models.Article)
    if category:
        query = query.filter(models.Article.category == category)
    # 按从新到旧排列
    articles = query.order_by(models.Article.id.desc()).offset(skip).limit(limit).all()
    return articles

@router.get("/{article_id}", response_model=schemas.ArticleOut)
def read_article(article_id: int, db: Session = Depends(database.get_db)) -> Any:
    article = db.query(models.Article).filter(models.Article.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="文章已被抹除或尚未建立。")
    return article

@router.post("/", response_model=schemas.ArticleOut)
def create_article(
    article: schemas.ArticleCreate, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
) -> Any:
    """ 由认证用户投递自己的著作并立刻署名烙印 """
    new_article = models.Article(
        **article.model_dump(),
        author_id=current_user.id
    )
    db.add(new_article)
    db.commit()
    db.refresh(new_article)
    return new_article

@router.delete("/{article_id}")
def delete_article(
    article_id: int, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
) -> Any:
    """ 高维抹除校验：仅发行者或系统超级管理员有权斩断数据。 """
    article = db.query(models.Article).filter(models.Article.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="文章原本就不存在。")
    
    # 核心权属校验：如果非该文章的 author_id，并且身披角色又不属于 Admin
    if article.author_id != current_user.id and current_user.role != models.RoleEnum.admin:
        raise HTTPException(status_code=403, detail="非法越权销毁：你不是该文章的拥有者，亦无大盘总控权限。")
    
    db.delete(article)
    db.commit()
    return {"status": "SUCCESS", "detail": "材料已被永久断链销毁。"}
