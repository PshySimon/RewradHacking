import os
import uuid
import shutil
import urllib.request
import urllib.error
from pydantic import BaseModel
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


class LinkFetchReq(BaseModel):
    url: str

@router.post("/fetch_image")
def fetch_external_image(
    req: LinkFetchReq,
    current_user: models.User = Depends(auth.get_current_user)
) -> Any:
    """
    专门为编辑器 Vditor 开启的“暗网”抓取后门：
    只要是从剪贴板贴进来的外部公网图档链接，全部走这里由服务器代为打捞保存，借此彻底抹杀外部图床失效带来的风险！
    """
    image_url = req.url
    if not image_url.startswith("http"):
        raise HTTPException(status_code=400, detail="拦截失败，所提供的标的非网络 HTTP 寻参制式。")

    try:
        import time
        max_retries = 3
        last_error = None
        
        for attempt in range(max_retries):
            try:
                # 增强版防护伪装，模拟最真实的浏览器请求
                headers = {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
                }
                
                # 阿里语雀(nlark) 采用了极严的防盗链，若 Referer 为外站（或伪造成自己的 CDN），会被直接 403。
                # 去除 Referer（模拟用户在浏览器地址栏直接敲击回车或从微信等聊天框点开）是不触发拦截的最佳姿势。
                # 针对少量必须要求自我引用的老式图床，做后备兼容。
                if 'nlark.com' not in image_url and 'yuque.com' not in image_url:
                    headers['Referer'] = image_url

                req_obj = urllib.request.Request(image_url, headers=headers)
                
                with urllib.request.urlopen(req_obj, timeout=12.0) as response:
                    content = response.read()
                    
                    if not content:
                        raise ValueError("抓取到了一个空文件内容")
                    
                    # 使用原图格式截取；如果极度变态不带后缀的，我们就强制洗贴个 .jpg 狗皮膏药
                    ext = "jpg"
                    possible_ext = image_url.split("/")[-1].split(".")[-1].split("?")[0].lower()
                    if possible_ext in ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"]:
                        ext = possible_ext
                            
                    safe_filename = f"{uuid.uuid4().hex}.{ext}"
                    file_path = os.path.join(UPLOAD_DIR, safe_filename)
                    
                    # 正式物理写入！存入和自主上传同一片绝对领域！
                    with open(file_path, "wb") as f:
                        f.write(content)
                        
                    new_url = f"/api/static/images/{safe_filename}"
                    
                    # 严格遵照 Vditor 那套极度霸道且固化的要求返回洗白结果
                    return {
                        "msg": "走私原图本地洗白成功",
                        "code": 0,
                        "data": {
                            "originalURL": image_url,
                            "url": new_url
                        }
                    }
            except Exception as loop_e:
                last_error = loop_e
                time.sleep(0.5) # 稍微喘口气再次重试，防止被对方 WAF 拦截
                
        # 如果重试 3 次依然全盘皆输
        raise last_error

    except Exception as e:
        # 不能用 500 把人家弹死，返回 code 1 告知前端打平重来或者原样展示
        print(f"走私外源图库被彻底粉碎反噬 (重试3次后): {e}")
        return {
            "msg": f"抓取外哨资源失败: {str(e)}",
            "code": 1
        }
