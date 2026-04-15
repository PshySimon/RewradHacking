from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from ..database import get_db
from ..models import Draft, User, CategoryEnum, get_current_time
from ..schemas import DraftCreate, DraftOut
from ..auth import get_current_user
from ..image_assets import clear_image_references, sync_image_references
from .upload import UPLOAD_DIR

router = APIRouter(prefix="/api/drafts", tags=["Drafts"])

@router.get("/", response_model=List[DraftOut])
def get_drafts(
    category: Optional[CategoryEnum] = None,
    target_id: Optional[str] = None,
    only_standalone: bool = False,
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    query = db.query(Draft).filter(Draft.user_id == current_user.id)
    if category:
        query = query.filter(Draft.category == category)
    if target_id:
        query = query.filter(Draft.target_id == target_id)
    
    # 【隔离区】仅拉取“独立文章”性质的草稿，断绝那些被强关联在某具体文章下的靶场/记录型碎片
    if only_standalone:
        query = query.filter(Draft.target_id.is_(None))

    # 按更新时间倒序，最新的在最上面
    return query.order_by(Draft.updated_at.desc()).all()


@router.post("/", response_model=DraftOut)
def create_or_upsert_draft(
    draft_in: DraftCreate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    # 【特殊拦截槽】：代码靶场的专用逻辑 (仅针对带有目标 ID 的，即真正靶场内解题的草稿)
    if draft_in.category == CategoryEnum.code and draft_in.target_id:
        
        # 寻找本题下我的历史代码草稿
        existing = db.query(Draft).filter(
            Draft.user_id == current_user.id, 
            Draft.category == CategoryEnum.code, 
            Draft.target_id == draft_in.target_id
        ).first()
        
        if existing:
            # 开启静默覆盖 Upsert
            existing.content = draft_in.content
            existing.updated_at = get_current_time()
            db.commit()
            db.refresh(existing)
            sync_image_references(
                db,
                owner_type="draft",
                owner_id=existing.id,
                field="content",
                content=existing.content,
                upload_dir=UPLOAD_DIR,
            )
            return existing
            
        # 若是该题处女作则跳过多重建立检验直接落定
        new_draft = Draft(**draft_in.dict(), user_id=current_user.id)
        db.add(new_draft)
        db.commit()
        db.refresh(new_draft)
        sync_image_references(
            db,
            owner_type="draft",
            owner_id=new_draft.id,
            field="content",
            content=new_draft.content,
            upload_dir=UPLOAD_DIR,
        )
        return new_draft

    # 【常规弹夹上限审核机制】：知识/面经/题解 只能存 5 份（且必须是不带 target_id 独立存储的正经草稿）
    count = db.query(Draft).filter(
        Draft.user_id == current_user.id, 
        Draft.category == draft_in.category,
        Draft.target_id.is_(None)
    ).count()
    if count >= 5:
        # 直接阻断异常，抛回给前端弹窗要求清理
        raise HTTPException(status_code=400, detail=f"您的{draft_in.category.value}草稿箱已处于溢出状态 (5/5 份上限)。请前往管理处删除不必要的旧草稿以腾出空间。")

    new_draft = Draft(**draft_in.dict(), user_id=current_user.id)
    db.add(new_draft)
    db.commit()
    db.refresh(new_draft)
    sync_image_references(
        db,
        owner_type="draft",
        owner_id=new_draft.id,
        field="content",
        content=new_draft.content,
        upload_dir=UPLOAD_DIR,
    )
    return new_draft


@router.put("/{draft_id}", response_model=DraftOut)
def update_draft(
    draft_id: str, 
    draft_in: DraftCreate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    # 存量覆写指令：对本来就在草稿箱里被捞出来回填并修改保存的任务发起精确打击。不检验大类总量，因为没新增
    draft = db.query(Draft).filter(Draft.id == draft_id, Draft.user_id == current_user.id).first()
    if not draft:
        raise HTTPException(status_code=404, detail="草稿不存在或无权操作")
        
    draft.title = draft_in.title
    draft.content = draft_in.content
    draft.code_template = draft_in.code_template
    draft.tags = draft_in.tags
    draft.updated_at = get_current_time()
    db.commit()
    db.refresh(draft)
    sync_image_references(
        db,
        owner_type="draft",
        owner_id=draft.id,
        field="content",
        content=draft.content,
        upload_dir=UPLOAD_DIR,
    )
    return draft


@router.delete("/{draft_id}")
def delete_draft(
    draft_id: str, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    draft = db.query(Draft).filter(Draft.id == draft_id, Draft.user_id == current_user.id).first()
    if not draft:
        raise HTTPException(status_code=404, detail="此草稿记录不存在")
    clear_image_references(db, owner_type="draft", owner_id=draft.id, upload_dir=UPLOAD_DIR)
    db.delete(draft)
    db.commit()
    return {"status": "success"}
