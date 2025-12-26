from fastapi import FastAPI, BackgroundTasks, HTTPException, Header
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import database as db
import worker

app = FastAPI()

GOOGLE_CLIENT_ID = "237320924792-b8jugiphuech1l8mjr7ieecopc0829it.apps.googleusercontent.com"

# --- CẤU HÌNH CORS (Quan trọng) ---
# Để Frontend (React) ở cổng 3000 có thể gọi API ở cổng 8000
origins = [
    "http://localhost:3000",
    "http://localhost:5173", # Vite React default port
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- DATA MODELS (Pydantic) ---
# Định nghĩa khuôn mẫu dữ liệu trả về cho Frontend
class VideoResponse(BaseModel):
    id: str
    channel_id: str
    channel_name: Optional[str] = "Unknown" # <--- Thêm dòng này
    title: str
    thumbnail: str
    published_at: int
    embed_url: str

class ChannelRequest(BaseModel):
    url: str

class LoginRequest(BaseModel):
    token: str

class ChannelRequest(BaseModel):
    url: str
    user_id: str # Thêm trường này để biết ai là người thêm

# 2. Cập nhật API add_channel
@app.post("/api/channels")
def add_channel(request: ChannelRequest, background_tasks: BackgroundTasks):
    """
    1. Lấy Channel ID NGAY LẬP TỨC.
    2. Subscribe user vào kênh đó NGAY LẬP TỨC.
    3. Sau đó mới chạy worker cào video ngầm.
    """
    if "youtube.com" not in request.url and "youtu.be" not in request.url:
        raise HTTPException(status_code=400, detail="Link YouTube không hợp lệ")

    # BƯỚC 1: Lấy Channel ID nhanh
    channel_id = worker.get_channel_id_from_url(request.url)
    
    if not channel_id:
        # Nếu không lấy được ID, có thể link sai hoặc kênh chết -> Báo lỗi luôn
        raise HTTPException(status_code=400, detail="Không tìm thấy ID kênh. Hãy kiểm tra lại link.")

    print(f"✅ Tìm thấy Channel ID: {channel_id}")

    # BƯỚC 2: Subscribe User ngay lập tức (Quan trọng!)
    # Để khi reload trang là thấy ngay (dù video đang cào)
    db.subscribe_channel(request.user_id, channel_id)
    
    # BƯỚC 3: Lưu thông tin kênh cơ bản vào Redis (để không bị lỗi missing info)
    if not db.is_channel_exist(channel_id):
        # Lưu tạm tên kênh là URL, worker sẽ update tên thật sau
        db.add_channel_to_db(channel_id, "New Channel", "https://via.placeholder.com/150")

    # BƯỚC 4: Chạy worker cào video ngầm (Full Sync)
    background_tasks.add_task(worker.sync_full_channel, request.url)
    
    return {
        "status": "success", 
        "channel_id": channel_id,
        "message": "Đã thêm và theo dõi kênh thành công! Video đang được tải về..."
    }

# API Lấy danh sách kênh đã sub (kèm thông tin chi tiết)
@app.get("/api/subscriptions")
def get_subscriptions(user_id: str):
    # 1. Lấy list ID
    sub_ids = db.get_user_subscriptions(user_id)
    if not sub_ids:
        return []
    
    # 2. Lấy info chi tiết từng kênh
    channels = db.get_channels_info(sub_ids)
    return channels

# API Hủy đăng ký
class UnsubRequest(BaseModel):
    user_id: str
    channel_id: str

@app.post("/api/unsubscribe")
def unsubscribe(req: UnsubRequest):
    is_deleted = db.unsubscribe_channel(req.user_id, req.channel_id)
    
    msg = "Đã bỏ theo dõi."
    if is_deleted:
        msg += " Kênh này đã bị xóa khỏi hệ thống vì bạn là người cuối cùng."
        
    return {"status": "ok", "message": msg}

@app.post("/api/auth/google")
def login_google(request: LoginRequest):
    """Nhận token từ React, verify với Google và lưu User"""
    try:
        # 1. Xác thực token với Google (Cực kỳ an toàn)
        idinfo = id_token.verify_oauth2_token(
            request.token, google_requests.Request(), GOOGLE_CLIENT_ID
        )

        # 2. Lưu user vào Redis
        user = db.create_or_update_user(idinfo)
        
        return user # Trả về info để Frontend lưu
    except ValueError:
        raise HTTPException(status_code=401, detail="Token không hợp lệ")

@app.post("/api/subscribe")
def subscribe(data: dict):
    # data: {user_id: "...", channel_id: "..."}
    # (Trong thực tế nên dùng Header Authorization, nhưng làm nhanh thì truyền body)
    db.subscribe_channel(data['user_id'], data['channel_id'])
    return {"status": "ok", "message": f"Đã theo dõi kênh {data['channel_id']}"}

# --- API ENDPOINTS ---

@app.get("/")
def read_root():
    return {"message": "Welcome to YT-TikTok API"}

@app.get("/api/feed", response_model=List[VideoResponse])
def get_feed(user_id: Optional[str] = None, page: int = 1, limit: int = 10):
    """
    Nếu có user_id -> Lấy video từ các kênh user đã Sub.
    Nếu không -> Lấy video mặc định (Caro English).
    """
    offset = (page - 1) * limit
    
    target_channels = []
    
    if user_id:
        # Lấy danh sách kênh user đã sub
        subs = db.get_user_subscriptions(user_id)
        if subs:
            target_channels = subs
        else:
            # User mới chưa sub ai -> Trả về kênh mặc định
            target_channels = ["UCGV3L8VTtvew5_yYVPObX0Q"] 
    else:
        target_channels = ["UCGV3L8VTtvew5_yYVPObX0Q"]

    # Logic lấy video từ nhiều kênh (đơn giản hóa: lấy mỗi kênh một ít rồi trộn)
    # Để đơn giản cho bài này: Lấy kênh đầu tiên trong danh sách
    # (Muốn xịn hơn phải dùng Redis ZUNIONSTORE - nâng cao sau nhé)
    primary_channel = target_channels[0] 
    
    raw_videos = db.get_videos_from_channel(primary_channel, limit, offset)
    
    clean_videos = []
    for v in raw_videos:
        # === ĐOẠN MỚI: Lấy tên kênh từ Redis ===
        # Redis lưu info kênh ở key: channel:{id}:info
        # Chúng ta lấy field 'name' ra
        channel_info = db.r.hgetall(f"channel:{v['channel_id']}:info")
        channel_name = channel_info.get("name", f"@{v['channel_id']}") # Nếu chưa có tên thì dùng tạm ID
        
        clean_videos.append({
            "id": v['id'],
            "channel_id": v['channel_id'],
            "channel_name": channel_name, # <--- Gửi thêm cái này
            "title": v['title'],
            "thumbnail": v['thumbnail'],
            "published_at": int(v['published_at']),
            "embed_url": f"https://www.youtube.com/embed/{v['id']}?autoplay=1"
        })
        
    return clean_videos

@app.post("/api/channels")
def add_channel(request: ChannelRequest, background_tasks: BackgroundTasks):
    """
    API để User thêm kênh mới.
    Sử dụng BackgroundTasks để chạy worker ngầm, không làm user phải chờ.
    """
    # Validate input (đơn giản)
    if "youtube.com" not in request.url:
        raise HTTPException(status_code=400, detail="Link không hợp lệ")

    # Kích hoạt worker chạy ngầm (Fire and Forget)
    background_tasks.add_task(worker.sync_full_channel, request.url)
    
    return {"status": "processing", "message": "Đang bắt đầu quét kênh trong nền..."}