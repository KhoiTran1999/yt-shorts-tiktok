from random import random
import redis
import json
import time
import os

# Kết nối Redis
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
r = redis.from_url(REDIS_URL, decode_responses=True)

# === CÁC HÀM XỬ LÝ CHANNEL ===
def add_channel_to_db(channel_id, name, avatar_url, description=""):
    """Lưu thông tin kênh vào Hash"""
    key = f"channel:{channel_id}:info"
    data = {
        "id": channel_id,
        "name": name,
        "avatar": avatar_url,
        "description": description, # <-- MỚI: Lưu mô tả
        "last_sync": int(time.time())
    }
    r.hset(key, mapping=data)
    print(f"✅ Đã lưu kênh: {name}")

def is_channel_exist(channel_id):
    """Kiểm tra kênh đã có trong DB chưa"""
    return r.exists(f"channel:{channel_id}:info")

# === CÁC HÀM XỬ LÝ VIDEO ===
def add_video_to_db(channel_id, video_id, title, thumbnail):
    timestamp = int(time.time())
    
    # 1. Lưu metadata
    video_key = f"video:{video_id}"
    video_data = {
        "id": video_id, "channel_id": channel_id, "title": title,
        "thumbnail": thumbnail, "published_at": timestamp
    }
    r.hset(video_key, mapping=video_data)
    
    # 2. Lưu vào list kênh & list global
    r.zadd(f"channel:{channel_id}:videos", {video_id: timestamp})
    r.zadd("videos:all", {video_id: timestamp})
    
    # 3. [QUAN TRỌNG] Khởi tạo điểm = 0 cho video mới
    r.zadd("videos:score", {video_id: 0}, nx=True)

# === HÀM CỘNG ĐIỂM (TÍNH VIEW) ===
def increase_video_score(video_id):
    # Cộng 1 điểm. Zincrby trả về điểm mới
    new_score = r.zincrby("videos:score", 1, video_id)
    print(f"📈 Video {video_id} +1 view -> Score: {new_score}")
    return new_score

# === LOGIC FEED THÔNG MINH (CHO CẢ GLOBAL & SUB) ===
def init_feed_session(session_id, user_id=None):
    POOL_SIZE = 500
    video_ids = []

    # --- TRƯỜNG HỢP 1: USER ĐÃ LOGIN & CÓ SUB (OPTION 2 PHỨC TẠP) ---
    if user_id:
        subs = list(r.smembers(f"user:{user_id}:subs"))
        if subs:
            # B1: Tạo key tạm chứa TẤT CẢ video của các kênh đã sub
            # (Key này dùng timestamp làm score)
            temp_all_subs = f"temp:calc:{session_id}:step1"
            keys_to_union = [f"channel:{cid}:videos" for cid in subs]
            
            if keys_to_union:
                r.zunionstore(temp_all_subs, keys_to_union)
                r.expire(temp_all_subs, 60) # Tự hủy sau 60s
                
                # B2: [MAGIC STEP] Giao (Intersect) với bảng điểm Global
                # Mục đích: Lọc ra các video Sub NHƯNG sắp xếp theo Score (Điểm thấp lên đầu)
                # weights=[0, 1]: Nghĩa là bỏ qua score timestamp (x0), lấy score view (x1)
                temp_scored_subs = f"temp:calc:{session_id}:step2"
                r.zinterstore(
                    temp_scored_subs, 
                    keys=[temp_all_subs, "videos:score"], 
                    weights=[0, 1] 
                )
                r.expire(temp_scored_subs, 60)

                # B3: Lấy 500 video điểm thấp nhất từ tập hợp đã giao
                video_ids = r.zrange(temp_scored_subs, 0, POOL_SIZE - 1)

    # --- TRƯỜNG HỢP 2: KHÁCH LẠ HOẶC KHÔNG SUB AI (GLOBAL FEED) ---
    if not video_ids:
        # Lấy 500 video điểm thấp nhất toàn hệ thống
        video_ids = r.zrange("videos:score", 0, POOL_SIZE - 1)
        
        # Fallback: Nếu hệ thống mới tinh chưa có score, lấy theo thời gian
        if not video_ids:
            video_ids = r.zrevrange("videos:all", 0, POOL_SIZE - 1)

    if not video_ids:
        return False

    # --- BƯỚC CUỐI: SHUFFLE (BẮT BUỘC) ---
    random.shuffle(video_ids)

    # Lưu vào Session
    session_key = f"session:{session_id}"
    r.delete(session_key)
    r.rpush(session_key, *video_ids)
    r.expire(session_key, 7200)
    
    print(f"🎲 Session {session_id} initialized with {len(video_ids)} videos (Fairness Mode)")
    return True

# ... (GIỮ NGUYÊN CÁC HÀM GET SESSION, GET VIDEO, USER...) ...
def get_videos_from_session(session_id, limit=5):
    session_key = f"session:{session_id}"
    video_ids = r.lpop(session_key, limit)
    if not video_ids: return []
    return get_videos_from_ids(video_ids)

def get_videos_from_ids(video_ids):
    results = []
    for vid in video_ids:
        info = r.hgetall(f"video:{vid}")
        if info:
            channel_info = r.hgetall(f"channel:{info['channel_id']}:info")
            info['channel_name'] = channel_info.get("name", "Unknown")
            info['channel_avatar'] = channel_info.get("avatar", "")
            results.append(info)
    return results

def get_global_videos(limit=10, offset=0):
    """Lấy video cho khách (Lấy từ videos:all)"""
    video_ids = r.zrevrange("videos:all", offset, offset + limit - 1)
    return get_videos_from_ids(video_ids)

def get_subscribed_videos(user_id, limit=10, offset=0):
    """
    Lấy video CHỈ từ các kênh đã Sub.
    Sử dụng kỹ thuật ZUNIONSTORE của Redis để gộp các Key con thành Key tạm.
    """
    # 1. Lấy danh sách channel_id user đang sub
    subs = list(r.smembers(f"user:{user_id}:subs"))
    if not subs:
        return []

    # 2. Tạo key tạm để gộp video
    temp_key = f"temp:feed:{user_id}"
    
    # Danh sách các key cần gộp: channel:{id}:videos
    keys_to_union = [f"channel:{cid}:videos" for cid in subs]
    
    if keys_to_union:
        # Gộp tất cả video lại, giữ nguyên timestamp (MAX/SUM đều được vì score giống nhau)
        r.zunionstore(temp_key, keys_to_union)
        
        # Set thời gian sống cho key tạm (60s) để Redis tự dọn rác
        r.expire(temp_key, 60)
        
        # 3. Lấy dữ liệu phân trang từ key tạm
        video_ids = r.zrevrange(temp_key, offset, offset + limit - 1)
        return get_videos_from_ids(video_ids)
    
    return []

def get_videos_from_channel(channel_id, limit=10, offset=0):
    """Lấy danh sách video của 1 kênh cụ thể"""
    key = f"channel:{channel_id}:videos"
    video_ids = r.zrevrange(key, offset, offset + limit - 1)
    return get_videos_from_ids(video_ids)

# === CÁC HÀM XỬ LÝ USER (Giữ nguyên) ===
def create_or_update_user(user_info):
    google_id = user_info['sub']
    key = f"user:{google_id}:info"
    data = {
        "id": google_id,
        "name": user_info['name'],
        "email": user_info['email'],
        "avatar": user_info['picture'],
        "last_login": int(time.time())
    }
    r.hset(key, mapping=data)
    return data

def subscribe_channel(user_id, channel_id):
    r.sadd(f"user:{user_id}:subs", channel_id)
    r.sadd(f"channel:{channel_id}:followers", user_id)
    print(f"✅ User {user_id} sub {channel_id}")

def unsubscribe_channel(user_id, channel_id):
    print(f"🚫 User {user_id} un-sub {channel_id}...")
    r.srem(f"user:{user_id}:subs", channel_id)
    
    follower_key = f"channel:{channel_id}:followers"
    r.srem(follower_key, user_id)
    
    # Nếu không còn ai follow thì xóa kênh
    if r.scard(follower_key) == 0:
        print(f"♻️ Kênh {channel_id} trống -> Xóa sổ.")
        delete_entire_channel(channel_id)
        return True
    return False

def delete_entire_channel(channel_id):
    video_list_key = f"channel:{channel_id}:videos"
    video_ids = r.zrange(video_list_key, 0, -1)
    
    if video_ids:
        # Xóa các video khỏi Hash chi tiết
        r.delete(*[f"video:{vid}" for vid in video_ids])
        # Xóa các video khỏi Global Feed (QUAN TRỌNG)
        r.zrem("videos:all", *video_ids)
    
    r.delete(video_list_key)
    r.delete(f"channel:{channel_id}:info")
    r.delete(f"channel:{channel_id}:followers")
    print(f"🗑️ Đã xóa kênh {channel_id}")

def get_channels_info(channel_ids):
    channels = []
    for cid in channel_ids:
        info = r.hgetall(f"channel:{cid}:info")
        if info: channels.append(info)
    return channels

def get_all_channels():
    """Lấy danh sách thông tin tất cả các kênh trong hệ thống"""
    # Lấy tất cả key có dạng channel:*:info
    keys = r.keys("channel:*:info")
    channels = []
    for key in keys:
        info = r.hgetall(key)
        if info:
            channels.append(info)
    return channels

def get_user_subscriptions(user_id):
    key = f"user:{user_id}:subs"
    return list(r.smembers(key))

def get_global_video_ids(limit=200, offset=0, sort_by="score_asc"):
    """
    Lấy ID video toàn cầu.
    - sort_by="time": Mới nhất (videos:all)
    - sort_by="score_asc": Ít view nhất (videos:score) -> Logic cũ (Fairness)
    - sort_by="score_desc": Nhiều view nhất (videos:score) -> Trending
    """
    if sort_by == "time":
        # Lấy theo thời gian (Mới nhất)
        return r.zrevrange("videos:all", offset, offset + limit - 1)
    
    elif sort_by == "score_asc":
        # Lấy theo điểm thấp nhất (Ưu tiên video ít người xem)
        return r.zrange("videos:score", offset, offset + limit - 1)
    
    else: # score_desc
        # Lấy theo điểm cao nhất (Trending)
        return r.zrevrange("videos:score", offset, offset + limit - 1)

def get_subscribed_video_ids(user_id, limit=200, offset=0, sort_by="score_asc"):
    """
    Lấy ID từ các kênh đã Sub, CÓ kết hợp tính điểm.
    """
    subs = list(r.smembers(f"user:{user_id}:subs"))
    if not subs: return []

    # 1. Gom tất cả video của các kênh đã sub
    keys_to_union = [f"channel:{cid}:videos" for cid in subs]
    
    if not keys_to_union: return []

    # Key tạm 1: Chứa tất cả video của sub (Score là Timestamp)
    temp_sub_all = f"temp:sub_all:{user_id}"
    r.zunionstore(temp_sub_all, keys_to_union)
    r.expire(temp_sub_all, 60) # Tự hủy sau 60s

    # 2. [QUAN TRỌNG] Giao với bảng điểm (videos:score) để lấy View
    # Logic: Chỉ lấy những video nằm trong temp_sub_all, nhưng dùng Score của videos:score
    temp_final = f"temp:sub_scored:{user_id}"
    
    # === 👇 DÒNG ĐÃ SỬA Ở ĐÂY 👇 ===
    # Thay vì weights=[0, 1], ta truyền dictionary
    r.zinterstore(temp_final, keys={temp_sub_all: 0, "videos:score": 1})
    
    r.expire(temp_final, 60)

    # 3. Lấy ID ra theo thứ tự mong muốn
    if sort_by == "score_asc":
        return r.zrange(temp_final, offset, offset + limit - 1) # Ít view nhất
    elif sort_by == "score_desc":
        return r.zrevrange(temp_final, offset, offset + limit - 1) # Nhiều view nhất
    else:
        # Nếu muốn sort theo time thì lấy từ temp_sub_all gốc (Mới nhất)
        return r.zrevrange(temp_sub_all, offset, offset + limit - 1)
