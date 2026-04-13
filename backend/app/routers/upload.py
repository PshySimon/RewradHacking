import os
import uuid
import shutil
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from typing import Any

from .. import auth, models

router = APIRouter(prefix="/api/upload", tags=["Upload"])

# 指定核心上行托管舱，安全脱离于前端热重载
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data/uploads")

# 确保启动时静默存在
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

@router.post("/image")
def upload_image(
    file: UploadFile = File(...), 
    current_user: models.User = Depends(auth.get_current_user)
) -> Any:
    """
    接收富文本组件的高爆文件上传并返还安全的沙盒调用 URI。
    严格隔离验证，只有持票据者可载入系统。
    """
    # 白名单强制检验：
    if file.content_type not in ["image/jpeg", "image/png", "image/gif", "image/webp"]:
        raise HTTPException(status_code=400, detail="检测到非静态图档的潜入尝试！")
    
    # 获取散列名称，防止跨系统重名覆盖
    ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    safe_filename = f"{uuid.uuid4().hex}.{ext}"
    file_path = os.path.join(UPLOAD_DIR, safe_filename)
    
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail="托管舱数据封入失败。")
        
    # 我们将在主线中暴露 /static/images/... 代理到这里
    return {"url": f"/api/static/images/{safe_filename}", "message": "图床资源绑定就绪。"}
