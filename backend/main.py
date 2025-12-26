from fastapi import FastAPI, BackgroundTasks, HTTPException, Header
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import database as db
import worker
import random
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")

origins = ["http://localhost:3000", "http://localhost:5173"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- MODELS ---
class VideoResponse(BaseModel):
    id: str
    channel_id: str
    channel_name: Optional[str] = "Unknown"
    channel_avatar: Optional[str] = "https://via.placeholder.com/150"
    title: str
    thumbnail: str
    published_at: int
    embed_url: str

class LoginRequest(BaseModel):
    token: str

class ChannelRequest(BaseModel):
    url: str
    user_id: str

class UnsubRequest(BaseModel):
    user_id: str
    channel_id: str

# --- API CHÍNH: GET FEED (ĐÃ SỬA LOGIC) ---
@app.get("/api/feed", response_model=List[VideoResponse])
def get_feed(user_id: Optional[str] = None, page: int = 1, limit: int = 10):
    # offset = (page - 1) * limit  <-- KHÔNG DÙNG OFFSET KIỂU CŨ NỮA
    
    clean_videos = []
    
    # --- LOGIC MỚI: RANDOM POOL ---
    # Thay vì lấy từng trang nhỏ, ta lấy 1 lượng lớn video gần đây (Pool)
    # Ví dụ: Lấy 200 video mới nhất để trộn
    POOL_SIZE = 200 
    
    raw_videos = []
    
    if user_id:
        subs = db.get_user_subscriptions(user_id)
        if subs:
            # Nếu có sub: Lấy 200 video từ các kênh sub
            raw_videos = db.get_subscribed_videos(user_id, limit=POOL_SIZE, offset=0)
        else:
            # Nếu không sub: Lấy 200 video global
            raw_videos = db.get_global_videos(limit=POOL_SIZE, offset=0)
    else:
        # Khách: Lấy 200 video global
        raw_videos = db.get_global_videos(limit=POOL_SIZE, offset=0)

    # Xử lý dữ liệu thô
    temp_list = []
    for v in raw_videos:
        channel_info = db.r.hgetall(f"channel:{v['channel_id']}:info")
        channel_name = channel_info.get("name", f"@{v['channel_id']}")
        channel_avatar = channel_info.get("avatar", "https://via.placeholder.com/150")
        
        temp_list.append({
            "id": v['id'],
            "channel_id": v['channel_id'],
            "channel_name": channel_name,
            "channel_avatar": channel_avatar,
            "title": v['title'],
            "thumbnail": v['thumbnail'],
            "published_at": int(v['published_at']),
            "embed_url": f"https://www.youtube.com/embed/{v['id']}?autoplay=0"
        })

    # --- THUẬT TOÁN TRỘN ---
    if len(temp_list) > 0:
        # 1. Trộn ngẫu nhiên toàn bộ Pool
        random.shuffle(temp_list)
        
        # 2. Giả lập phân trang bằng cách cắt list đã trộn
        # Lưu ý: Cách này có nhược điểm là có thể lặp lại video nếu reload, 
        # nhưng trải nghiệm lướt sẽ "random" hơn nhiều.
        # Để đơn giản cho giai đoạn này, ta cứ trả về ngẫu nhiên 'limit' video từ pool.
        clean_videos = temp_list[:limit]
    
    return clean_videos

# --- CÁC API KHÁC (GIỮ NGUYÊN) ---

@app.post("/api/channels")
def add_channel(request: ChannelRequest, background_tasks: BackgroundTasks):
    if "youtube.com" not in request.url and "youtu.be" not in request.url:
        raise HTTPException(status_code=400, detail="Link YouTube không hợp lệ")

    channel_id = worker.get_channel_id_from_url(request.url)
    if not channel_id:
        raise HTTPException(status_code=400, detail="Không tìm thấy ID kênh.")

    # Sub ngay lập tức
    db.subscribe_channel(request.user_id, channel_id)
    
    if not db.is_channel_exist(channel_id):
        db.add_channel_to_db(channel_id, "New Channel", "https://via.placeholder.com/150")

    background_tasks.add_task(worker.sync_full_channel, request.url)
    
    return {"status": "success", "channel_id": channel_id, "message": "Đã thêm kênh! Đang tải video..."}

@app.get("/api/subscriptions")
def get_subscriptions(user_id: str):
    sub_ids = db.get_user_subscriptions(user_id)
    if not sub_ids: return []
    return db.get_channels_info(sub_ids)

@app.post("/api/unsubscribe")
def unsubscribe(req: UnsubRequest):
    is_deleted = db.unsubscribe_channel(req.user_id, req.channel_id)
    msg = "Đã bỏ theo dõi."
    if is_deleted: msg += " Kênh này đã bị xóa vì không còn ai follow."
    return {"status": "ok", "message": msg}

@app.post("/api/auth/google")
def login_google(request: LoginRequest):
    try:
        idinfo = id_token.verify_oauth2_token(request.token, google_requests.Request(), GOOGLE_CLIENT_ID)
        user = db.create_or_update_user(idinfo)
        return user
    except ValueError:
        raise HTTPException(status_code=401, detail="Token không hợp lệ")

@app.get("/")
def read_root():
    return {"message": "Welcome to YT-TikTok API"}