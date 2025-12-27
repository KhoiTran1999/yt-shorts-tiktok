from fastapi import FastAPI, BackgroundTasks, HTTPException, Header, Query
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
import schedule
import threading
import time

load_dotenv()

app = FastAPI()

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")

origins_str = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5173,https://yt-shorts-tiktok.vercel.app")
origins = origins_str.split(",")

print(f"🚀 Allowed Origins: {origins}")

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

class SimpleSubRequest(BaseModel):
    user_id: str
    channel_id: str

# === CHỨC NĂNG TỰ ĐỘNG CRAWL (AUTO-SCHEDULER) ===
def job_daily_crawl():
    print("⏰ [Auto-Scan] Bắt đầu quét định kỳ lúc 03:00 AM...")
    try:
        # Lấy tất cả key thông tin kênh từ Redis
        # Pattern: channel:CHANNEL_ID:info
        keys = db.r.keys("channel:*:info")
        
        count = 0
        for key in keys:
            # Tách chuỗi để lấy Channel ID
            # key ví dụ: "channel:UC123abc:info" -> lấy phần tử số 1 là UC123abc
            channel_id = key.split(":")[1]
            
            # Gọi worker với limit=10
            worker.sync_channel_data(channel_id, limit=10)
            count += 1
            
        print(f"✅ [Auto-Scan] Đã quét xong {count} kênh.")
        
    except Exception as e:
        print(f"⚠️ [Auto-Scan] Lỗi: {e}")

def run_scheduler_thread():
    """Hàm chạy vòng lặp kiểm tra giờ trong luồng riêng"""
    while True:
        schedule.run_pending()
        time.sleep(60) # Kiểm tra mỗi phút 1 lần

# Thiết lập lịch chạy vào 03:00 sáng mỗi ngày
schedule.every().day.at("03:00").do(job_daily_crawl)

# Khởi động Scheduler trong luồng riêng (Daemon Thread)
# Để nó chạy song song với FastAPI mà không chặn server
threading.Thread(target=run_scheduler_thread, daemon=True).start()

#============================================================
# === API ENDPOINTS ===

# --- API CHÍNH: GET FEED (ĐÃ SỬA LOGIC) ---
@app.get("/api/feed", response_model=List[VideoResponse])
def get_feed(user_id: Optional[str] = None, page: int = 1, limit: int = 10):
    POOL_SIZE = 200  # Lấy pool lớn ID để random
    video_ids = []
    
    # CHỌN CHIẾN THUẬT SORT Ở ĐÂY:
    # "time": Mới nhất
    # "score_asc": Ít view nhất (Giống logic cũ của bạn)
    # "score_desc": Nhiều view nhất (Trending)
    STRATEGY = "score_asc"

    # 1. CHỈ LẤY DANH SÁCH ID (Rất nhanh, chưa lấy thông tin chi tiết)
    if user_id:
        subs = db.get_user_subscriptions(user_id)
        if subs:
            # Lấy video sub theo điểm
            video_ids = db.get_subscribed_video_ids(user_id, limit=POOL_SIZE, sort_by=STRATEGY)
            
            if not video_ids:
                # Fallback sang global nếu sub chưa có gì
                video_ids = db.get_global_video_ids(limit=POOL_SIZE, sort_by=STRATEGY)
        else:
            video_ids = db.get_global_video_ids(limit=POOL_SIZE, sort_by=STRATEGY)
    else:
        video_ids = db.get_global_video_ids(limit=POOL_SIZE, sort_by=STRATEGY)

    # 2. TRỘN ID VÀ CẮT (Thao tác trên RAM, cực nhanh)
    if video_ids:
        random.shuffle(video_ids)
        selected_ids = video_ids[:limit] # Chỉ lấy đúng số lượng cần thiết (VD: 5 ID)
    else:
        selected_ids = []

    # 3. BÂY GIỜ MỚI GỌI REDIS ĐỂ LẤY DATA (Chỉ tốn query cho 5 video thay vì 200)
    # Hàm này trong database.py đã tự lấy luôn thông tin Channel rồi
    final_videos = db.get_videos_from_ids(selected_ids)
    
    # 4. Map dữ liệu trả về cho đúng format Frontend
    clean_videos = []
    for v in final_videos:
        clean_videos.append({
            "id": v['id'],
            "channel_id": v['channel_id'],
            "channel_name": v.get('channel_name', "Unknown"),
            "channel_avatar": v.get('channel_avatar', "https://via.placeholder.com/150"),
            "title": v['title'],
            "thumbnail": v['thumbnail'],
            "published_at": int(v['published_at']),
            "embed_url": f"https://www.youtube.com/embed/{v['id']}?autoplay=0"
        })
    
    return clean_videos

@app.post("/api/view/{video_id}")
def count_view(video_id: str):
    """
    Frontend gọi API này khi người dùng xem >= 15s hoặc hết video.
    """
    db.increase_video_score(video_id)
    return {"status": "ok", "message": "View counted"}

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

@app.post("/api/channels/{channel_id}/sync")
def sync_specific_channel(channel_id: str, background_tasks: BackgroundTasks):
    """
    API để user chủ động làm mới 1 kênh.
    Có cơ chế chống Spam: Chỉ cho phép cập nhật 1 lần mỗi 10 phút.
    """
    if not db.is_channel_exist(channel_id):
         raise HTTPException(status_code=404, detail="Kênh không tồn tại")
    
    # --- ĐOẠN CODE MỚI: KIỂM TRA CHỐNG SPAM ---
    # 1. Lấy thông tin lần cập nhật cuối
    info = db.r.hgetall(f"channel:{channel_id}:info")
    last_sync = int(info.get("last_sync", 0))
    now = int(time.time())
    
    # 2. Nếu vừa cập nhật trong vòng 10 phút (600 giây) -> BỎ QUA
    # Giúp server không bị quá tải vì nhiều người cùng bấm
    if now - last_sync < 600:
         return {
             "status": "ignored", 
             "message": "Kênh này vừa được cập nhật, vui lòng đợi thêm vài phút!"
         }
    # -------------------------------------------

    # Đẩy vào worker chạy ngầm
    background_tasks.add_task(worker.sync_channel_by_id, channel_id)
    
    return {"status": "ok", "message": f"Đang cập nhật kênh {channel_id}..."}

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

# --- API TÍNH NĂNG KHÁM PHÁ (EXPLORE) ---

@app.get("/api/channels/explore")
def get_explore_channels(user_id: str):
    # 1. Lấy tất cả kênh
    all_channels = db.get_all_channels()
    
    # 2. Lấy danh sách ID các kênh user đã sub
    sub_ids = db.get_user_subscriptions(user_id)
    
    # 3. Lọc: Chỉ lấy kênh KHÔNG nằm trong danh sách sub
    # (Nếu sub_ids rỗng thì lấy hết)
    explore_list = [c for c in all_channels if c['id'] not in sub_ids]
    
    return explore_list

@app.post("/api/subscribe/quick")
def quick_subscribe(req: SimpleSubRequest):
    """API theo dõi nhanh, không cần URL, chỉ cần ID"""
    if not db.is_channel_exist(req.channel_id):
        raise HTTPException(status_code=404, detail="Kênh không tồn tại")
        
    db.subscribe_channel(req.user_id, req.channel_id)
    return {"status": "ok", "message": f"Đã theo dõi kênh {req.channel_id}"}

@app.post("/api/auth/google")
def login_google(request: LoginRequest):
    try:
        idinfo = id_token.verify_oauth2_token(request.token, google_requests.Request(), GOOGLE_CLIENT_ID)
        user = db.create_or_update_user(idinfo)
        return user
    except ValueError:
        raise HTTPException(status_code=401, detail="Token không hợp lệ")

@app.head("/")
@app.get("/")
def read_root():
    return {"message": "Welcome to YT-TikTok API"}