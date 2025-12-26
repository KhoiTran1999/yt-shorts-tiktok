import redis
import json
import time

# Kết nối Redis
r = redis.Redis(host='localhost', port=6379, db=0, decode_responses=True)

# === CÁC HÀM XỬ LÝ CHANNEL ===
def add_channel_to_db(channel_id, name, avatar_url):
    """Lưu thông tin kênh vào Hash"""
    key = f"channel:{channel_id}:info"
    data = {
        "id": channel_id,
        "name": name,
        "avatar": avatar_url,
        "last_sync": int(time.time())
    }
    r.hset(key, mapping=data)
    print(f"✅ Đã lưu kênh: {name}")

def is_channel_exist(channel_id):
    """Kiểm tra kênh đã có trong DB chưa"""
    return r.exists(f"channel:{channel_id}:info")

# === CÁC HÀM XỬ LÝ VIDEO ===
def add_video_to_db(channel_id, video_id, title, thumbnail):
    """
    1. Lưu thông tin chi tiết video.
    2. Lưu vào danh sách riêng của kênh.
    3. Lưu vào danh sách GLOBAL (cho Guest xem).
    """
    timestamp = int(time.time()) 
    
    # 1. Lưu metadata video
    video_key = f"video:{video_id}"
    video_data = {
        "id": video_id,
        "channel_id": channel_id,
        "title": title,
        "thumbnail": thumbnail,
        "published_at": timestamp
    }
    r.hset(video_key, mapping=video_data)
    
    # 2. Thêm vào danh sách video của kênh (Sorted Set)
    r.zadd(f"channel:{channel_id}:videos", {video_id: timestamp})
    
    # 3. [MỚI] Thêm vào danh sách GLOBAL (cho Guest xem)
    r.zadd("videos:all", {video_id: timestamp})

def get_videos_from_ids(video_ids):
    """Hàm bổ trợ: Lấy chi tiết video từ danh sách ID"""
    results = []
    for vid in video_ids:
        info = r.hgetall(f"video:{vid}")
        if info:
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

def get_user_subscriptions(user_id):
    key = f"user:{user_id}:subs"
    return list(r.smembers(key))