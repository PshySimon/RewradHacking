from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Any
import os
import re

from .. import schemas, database, models, auth
from ..image_assets import clear_image_references, sync_image_references
from .upload import UPLOAD_DIR

router = APIRouter(prefix="/api/articles", tags=["Articles"])

@router.get("/", response_model=List[schemas.ArticleOut])
def read_articles(
    category: models.CategoryEnum = None, 
    skip: int = 0, limit: int = 100, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_optional_user)
) -> Any:
    """ 拉取对应分类的文章广场 """
    query = db.query(models.Article)
    if category:
        query = query.filter(models.Article.category == category)
    # 过滤掉 admin_only 文章，不对普通列表暴露
    query = query.filter(models.Article.visibility != models.VisibilityEnum.admin_only)
    # 按从新到旧排列
    articles = query.order_by(models.Article.id.desc()).offset(skip).limit(limit).all()
    
    # 对未登录游客，清空 registered 文章的正文内容
    if current_user is None:
        results = []
        for a in articles:
            out = schemas.ArticleOut.model_validate(a)
            if a.visibility == models.VisibilityEnum.registered:
                out.content = ""
                out.is_restricted = True
            results.append(out)
        return results
    return articles

@router.get("/{article_id}", response_model=schemas.ArticleOut)
def read_article(
    article_id: str, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_optional_user)
) -> Any:
    article = db.query(models.Article).filter(models.Article.id == article_id).first()
    if not article or article.category.value == 'code':
        raise HTTPException(status_code=404, detail="文章不存在。")
    # 浏览量自增
    article.views_count += 1
    db.commit()
    db.refresh(article)
    
    result = schemas.ArticleOut.model_validate(article)
    user = db.query(models.User).filter(models.User.id == article.author_id).first()
    if user:
        result.author_name = user.nickname or user.username
    # 如果文章是 registered 可见，且游客未登录，彻底清空内容
    if article.visibility == models.VisibilityEnum.registered and current_user is None:
        result.content = ""
        result.code_template = None
        result.is_restricted = True
    return result

@router.get("/code/{article_id}", response_model=schemas.ArticleOut)
def read_code_entity(
    article_id: str, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_optional_user)
) -> Any:
    """ 代码实体专用数据通道 """
    article = db.query(models.Article).filter(models.Article.id == article_id).first()
    if not article or article.category.value != 'code':
        raise HTTPException(status_code=404, detail="该代码实体不存在。")
    article.views_count += 1
    db.commit()
    db.refresh(article)
    
    # 补充映射作者名给前端展示
    user = db.query(models.User).filter(models.User.id == article.author_id).first()
    if user:
        article.author_name = user.nickname or user.username
    
    result = schemas.ArticleOut.model_validate(article)
    if user:
        result.author_name = user.nickname or user.username
    # 如果文章是 registered 可见，且游客未登录，彻底清空内容
    if article.visibility == models.VisibilityEnum.registered and current_user is None:
        result.content = ""
        result.code_template = None
        result.is_restricted = True
    return result

@router.get("/code/{article_id}/solutions", response_model=List[schemas.ArticleOut])
def read_code_solutions(article_id: str, db: Session = Depends(database.get_db)) -> Any:
    """ 提取与原题缔结过契约的所有题解实体 """
    mappings = db.query(models.SolutionMapping).filter(models.SolutionMapping.question_id == article_id).all()
    solution_ids = [m.solution_id for m in mappings]
    if not solution_ids:
        return []
    solutions = db.query(models.Article).filter(models.Article.id.in_(solution_ids)).order_by(models.Article.id.desc()).all()
    return solutions

@router.post("/code/{article_id}/solutions", response_model=schemas.ArticleOut)
def create_code_solution(
    article_id: str,
    article_in: schemas.ArticleCreate, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
) -> Any:
    """ 创建实体并将其降维打击锁定依附于目标题目 """
    question = db.query(models.Article).filter(models.Article.id == article_id).first()
    if not question or question.category.value != 'code':
        raise HTTPException(status_code=404, detail="目标底座损毁，题解拒签挂载。")
        
    new_article = models.Article(
        **article_in.model_dump(),
        author_id=current_user.id
    )
    db.add(new_article)
    db.commit()
    db.refresh(new_article)
    
    new_mapping = models.SolutionMapping(question_id=article_id, solution_id=new_article.id)
    db.add(new_mapping)
    db.commit()
    sync_image_references(
        db,
        owner_type="article",
        owner_id=new_article.id,
        field="content",
        content=new_article.content,
        upload_dir=UPLOAD_DIR,
    )
    
    return new_article

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
    sync_image_references(
        db,
        owner_type="article",
        owner_id=new_article.id,
        field="content",
        content=new_article.content,
        upload_dir=UPLOAD_DIR,
    )
    return new_article

@router.put("/{article_id}", response_model=schemas.ArticleOut)
def update_article(
    article_id: str,
    article_in: schemas.ArticleCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
) -> Any:
    article = db.query(models.Article).filter(models.Article.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="文章不存在。")
    if article.author_id != current_user.id and current_user.role != models.RoleEnum.admin:
        raise HTTPException(status_code=403, detail="无权修改他人的作品。")
    
    article.title = article_in.title
    article.content = article_in.content
    article.category = article_in.category
    article.visibility = article_in.visibility
    article.tags = article_in.tags
    
    db.commit()
    db.refresh(article)
    sync_image_references(
        db,
        owner_type="article",
        owner_id=article.id,
        field="content",
        content=article.content,
        upload_dir=UPLOAD_DIR,
    )
    return article

@router.delete("/{article_id}")
def delete_article(
    article_id: str, 
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
    
    comments = db.query(models.Comment).filter(models.Comment.article_id == article.id).all()
    for comment in comments:
        clear_image_references(db, owner_type="comment", owner_id=comment.id, upload_dir=UPLOAD_DIR)
        db.query(models.CommentLike).filter(models.CommentLike.comment_id == comment.id).delete(synchronize_session=False)
        db.delete(comment)

    clear_image_references(db, owner_type="article", owner_id=article.id, upload_dir=UPLOAD_DIR)
    db.delete(article)
    db.commit()
    return {"status": "SUCCESS", "detail": "材料已被永久断链销毁。"}

# ===================== [独立衍生业务：评论子生态网络] =====================

from datetime import datetime


def _normalize_annotation_text(value: str) -> str:
    text = (value or "").strip()
    # 安全上限：批注是轻量交互，不应超过 1200 字
    if len(text) > 1200:
        text = text[:1200]

    # 清理可疑注入，保留 plain text + emoji 的体验边界
    return re.sub(r"<[^>]*>", "", text)

@router.get("/{article_id}/comments", response_model=List[schemas.CommentOut])
def read_comments(
    article_id: str, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_optional_user)
):
    """ 提取热着陆区所有历史沉淀评论，并无感联查出我本人的点赞状态记录 """
    comments = db.query(models.Comment).filter(models.Comment.article_id == article_id).order_by(models.Comment.id.asc()).all()
    # 附带连表注入，在极简架构下手打作者组装
    out = []
    for c in comments:
        user = db.query(models.User).filter(models.User.id == c.author_id).first()
        comment_out = schemas.CommentOut.model_validate(c)
        if user:
            comment_out.author_username = user.username
            comment_out.author_nickname = user.nickname
            comment_out.author_avatar = user.avatar
            comment_out.author_role = user.role.value
        else:
            comment_out.author_username = "已注销的用户"
            comment_out.author_role = "user"
            
        # 点赞翻转态追踪
        comment_out.is_liked = False
        if current_user:
            like_exists = db.query(models.CommentLike).filter_by(comment_id=c.id, user_id=current_user.id).first()
            if like_exists:
                comment_out.is_liked = True
                
        out.append(comment_out)
    return out

@router.post("/{article_id}/comments", response_model=schemas.CommentOut)
def create_comment(
    article_id: str,
    comment_in: schemas.CommentCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """ 发表直冲心灵的高品质回复，同时底层挂载双写统计以抵御复杂连表开销。 """
    article = db.query(models.Article).filter(models.Article.id == article_id).first()
    if not article:
         raise HTTPException(status_code=404, detail="底层文章实体已遗失。")

    parent_comment = None
    if comment_in.parent_id:
        parent_comment = db.query(models.Comment).filter(
            models.Comment.id == comment_in.parent_id,
            models.Comment.article_id == article_id,
        ).first()
        if not parent_comment:
            raise HTTPException(status_code=400, detail="回复目标不存在。")
    
    new_comment = models.Comment(
        content=comment_in.content,
        article_id=article_id,
        author_id=current_user.id,
        parent_id=comment_in.parent_id,
        likes_count=0
    )
    db.add(new_comment)
    db.flush()
    # 同步双写统计表
    article.comments_count += 1

    target_path = f"/article/{article_id}#comment-{new_comment.id}"
    if article.category == models.CategoryEnum.code:
        target_path = f"/codeplay/{article_id}?comment_id={new_comment.id}"

    notified_recipient_ids = set()
    if current_user.id != article.author_id:
        notified_recipient_ids.add(article.author_id)
        db.add(models.Notification(
            recipient_id=article.author_id,
            actor_id=current_user.id,
            article_id=article_id,
            comment_id=new_comment.id,
            event_type="article_comment",
            target_path=target_path,
            snippet=(comment_in.content or "")[0:120],
        ))

    if parent_comment and parent_comment.author_id != current_user.id:
        if parent_comment.author_id not in notified_recipient_ids:
            notified_recipient_ids.add(parent_comment.author_id)
        db.add(models.Notification(
            recipient_id=parent_comment.author_id,
            actor_id=current_user.id,
            article_id=article_id,
            comment_id=new_comment.id,
            parent_comment_id=parent_comment.id,
            event_type="comment_reply",
            target_path=target_path,
            snippet=(comment_in.content or "")[0:120],
        ))

    db.commit()
    db.refresh(new_comment)
    sync_image_references(
        db,
        owner_type="comment",
        owner_id=new_comment.id,
        field="content",
        content=new_comment.content,
        upload_dir=UPLOAD_DIR,
    )
    
    res = schemas.CommentOut.model_validate(new_comment)
    res.author_username = current_user.username
    res.author_nickname = current_user.nickname
    res.author_avatar = current_user.avatar
    res.author_role = current_user.role.value
    return res


@router.get("/{article_id}/annotations", response_model=List[schemas.AnnotationOut])
def read_annotations(
    article_id: str,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_optional_user)
):
    """ 批注按行读取：用于阅读侧边栏“批注”模块。"""
    annotations = (
        db.query(models.Annotation)
        .filter(models.Annotation.article_id == article_id)
        .order_by(models.Annotation.id.asc())
        .all()
    )

    out = []
    for annotation in annotations:
        user = db.query(models.User).filter(models.User.id == annotation.author_id).first()
        recipient = None
        if annotation.recipient_id:
            recipient = db.query(models.User).filter(models.User.id == annotation.recipient_id).first()
        item = schemas.AnnotationOut.model_validate(annotation)
        if user:
            item.author_username = user.username
            item.author_nickname = user.nickname
            item.author_avatar = user.avatar
            item.is_owner = current_user is not None and current_user.id == user.id
        else:
            item.author_username = "已注销的用户"
        if recipient:
            item.recipient_username = recipient.username
            item.recipient_nickname = recipient.nickname
            item.recipient_avatar = recipient.avatar
        out.append(item)

    return out


@router.post("/{article_id}/annotations", response_model=schemas.AnnotationOut)
def create_annotation(
    article_id: str,
    annotation_in: schemas.AnnotationCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """ 纯文本批注：定位到正文的某一行，支持 emoji，限制 markdown 语义。"""
    article = db.query(models.Article).filter(models.Article.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="底层文章实体已遗失。")

    content = _normalize_annotation_text(annotation_in.content)
    if not content:
        raise HTTPException(status_code=400, detail="批注内容不能为空。")

    line_text = _normalize_annotation_text(annotation_in.line_text or "")
    if annotation_in.line_index < 1:
        raise HTTPException(status_code=400, detail="非法的行索引。")

    parent_annotation = None
    recipient_id = article.author_id
    target_line_index = annotation_in.line_index
    target_line_text = line_text[:240]
    event_type = "annotation"

    if annotation_in.parent_id:
        parent_annotation = db.query(models.Annotation).filter(
            models.Annotation.id == annotation_in.parent_id,
            models.Annotation.article_id == article_id,
        ).first()
        if not parent_annotation:
            raise HTTPException(status_code=400, detail="回复目标批注不存在。")
        recipient_id = parent_annotation.author_id
        target_line_index = parent_annotation.line_index
        target_line_text = parent_annotation.line_text
        event_type = "annotation_reply"

    new_annotation = models.Annotation(
        article_id=article_id,
        author_id=current_user.id,
        parent_id=parent_annotation.id if parent_annotation else None,
        recipient_id=recipient_id,
        line_index=target_line_index,
        line_text=target_line_text,
        content=content,
    )
    db.add(new_annotation)
    db.flush()

    target_path = f"/article/{article_id}#annotation-{new_annotation.id}"
    if recipient_id and current_user.id != recipient_id:
        db.add(models.Notification(
            recipient_id=recipient_id,
            actor_id=current_user.id,
            article_id=article_id,
            comment_id=new_annotation.id,
            event_type=event_type,
            target_path=target_path,
            snippet=f"第{target_line_index}行：{content[0:120]}",
        ))

    db.commit()
    db.refresh(new_annotation)

    out = schemas.AnnotationOut.model_validate(new_annotation)
    out.author_username = current_user.username
    out.author_nickname = current_user.nickname
    out.author_avatar = current_user.avatar
    recipient = db.query(models.User).filter(models.User.id == recipient_id).first()
    if recipient:
        out.recipient_username = recipient.username
        out.recipient_nickname = recipient.nickname
        out.recipient_avatar = recipient.avatar
    out.is_owner = True
    return out

@router.post("/{article_id}/comments/{comment_id}/like")
def toggle_like_comment(
    article_id: str,
    comment_id: str,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """ 双向切换：发射赞赏脉冲（点亮）亦可冷却脉冲（撤销）以坚决抵御刷单狂潮 """
    comment = db.query(models.Comment).filter(models.Comment.id == comment_id, models.Comment.article_id == article_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="无法为不存在的波函数点赞。")
        
    like = db.query(models.CommentLike).filter_by(comment_id=comment_id, user_id=current_user.id).first()
    if like:
        db.delete(like)
        comment.likes_count = max(0, comment.likes_count - 1)
        is_liked = False
    else:
        new_like = models.CommentLike(comment_id=comment_id, user_id=current_user.id)
        db.add(new_like)
        comment.likes_count += 1
        is_liked = True
        
    db.commit()
    return {"status": "SUCCESS", "likes_count": comment.likes_count, "is_liked": is_liked}
