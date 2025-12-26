import redis
import json
import time

# Kết nối Redis (decode_responses=True để nhận về String thay vì Bytes)
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
    # Mapping mapping dict vào Redis Hash
    r.hset(key, mapping=data)
    print(f"✅ Đã lưu kênh: {name}")

def is_channel_exist(channel_id):
    """Kiểm tra kênh đã có trong DB chưa"""
    return r.exists(f"channel:{channel_id}:info")

# === CÁC HÀM XỬ LÝ VIDEO ===
def add_video_to_db(channel_id, video_id, title, thumbnail):
    """
    1. Lưu thông tin chi tiết video vào Hash.
    2. Lưu video_id vào Sorted Set của kênh để sắp xếp theo thời gian.
    """
    timestamp = int(time.time()) # Tạm thời dùng thời gian hiện tại làm mốc sort
    
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
    # Score là timestamp (càng mới score càng cao)
    channel_video_key = f"channel:{channel_id}:videos"
    r.zadd(channel_video_key, {video_id: timestamp})
    
    # print(f"  -> Đã lưu video: {title[:30]}...")

def get_videos_from_channel(channel_id, limit=10, offset=0):
    """Lấy danh sách video để hiển thị (Feed)"""
    key = f"channel:{channel_id}:videos"
    
    # Lấy danh sách ID video từ mới nhất (ZREV RANGE)
    video_ids = r.zrevrange(key, offset, offset + limit - 1)
    
    results = []
    for vid in video_ids:
        # Lấy thông tin chi tiết từng video
        info = r.hgetall(f"video:{vid}")
        if info:
            results.append(info)
            
    return results

# === CÁC HÀM XỬ LÝ USER ===
def create_or_update_user(user_info):
    """
    Lưu thông tin user từ Google vào Redis.
    Key: user:{google_id}:info
    """
    google_id = user_info['sub'] # ID duy nhất của Google
    key = f"user:{google_id}:info"
    
    # Lưu thông tin cơ bản
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
    """
    User theo dõi kênh.
    Cập nhật 2 chiều: User->Channel và Channel->User
    """
    # 1. Thêm kênh vào danh sách sub của User
    r.sadd(f"user:{user_id}:subs", channel_id)
    
    # 2. Thêm user vào danh sách follower của Kênh (ĐỂ DÙNG CHO VIỆC XÓA SAU NÀY)
    r.sadd(f"channel:{channel_id}:followers", user_id)
    print(f"✅ User {user_id} đã sub {channel_id}")

# === HÀM MỚI: HỦY ĐĂNG KÝ & DỌN RÁC ===
def unsubscribe_channel(user_id, channel_id):
    """
    User bỏ theo dõi.
    Nếu kênh không còn ai theo dõi -> Xóa sạch dữ liệu kênh đó.
    """
    print(f"🚫 User {user_id} un-sub {channel_id}...")
    
    # 1. Xóa kênh khỏi danh sách sub của User
    r.srem(f"user:{user_id}:subs", channel_id)
    
    # 2. Xóa user khỏi danh sách follower của Kênh
    follower_key = f"channel:{channel_id}:followers"
    r.srem(follower_key, user_id)
    
    # 3. KIỂM TRA: Còn ai theo dõi kênh này không?
    remaining_followers = r.scard(follower_key) # Đếm số lượng trong Set
    
    if remaining_followers == 0:
        print(f"♻️ Kênh {channel_id} không còn ai theo dõi. Tiến hành xóa sổ...")
        delete_entire_channel(channel_id)
        return True # Trả về True nếu đã xóa kênh
        
    return False

def delete_entire_channel(channel_id):
    """Hàm dọn dẹp triệt để dữ liệu của 1 kênh"""
    # 1. Lấy danh sách video của kênh để xóa chi tiết từng video
    video_list_key = f"channel:{channel_id}:videos"
    video_ids = r.zrange(video_list_key, 0, -1)
    
    # Xóa từng Video Object (video:ID)
    if video_ids:
        # Tạo danh sách key cần xóa: "video:id1", "video:id2"...
        video_keys = [f"video:{vid}" for vid in video_ids]
        r.delete(*video_keys)
    
    # 2. Xóa danh sách video của kênh (Sorted Set)
    r.delete(video_list_key)
    
    # 3. Xóa thông tin kênh (Hash)
    r.delete(f"channel:{channel_id}:info")
    
    # 4. Xóa danh sách follower (Set) - Dù rỗng cũng delete cho sạch key
    r.delete(f"channel:{channel_id}:followers")
    
    print(f"🗑️ Đã xóa hoàn toàn kênh {channel_id} khỏi Database.")
    
# Thêm hàm lấy info nhiều kênh (để hiển thị danh sách quản lý)
def get_channels_info(channel_ids):
    channels = []
    for cid in channel_ids:
        info = r.hgetall(f"channel:{cid}:info")
        if info:
            channels.append(info)
    return channels

def get_user_subscriptions(user_id):
    """Lấy danh sách kênh user đang theo dõi"""
    key = f"user:{user_id}:subs"
    return list(r.smembers(key))

# Test thử kết nối
if __name__ == "__main__":
    try:
        r.ping()
        print("🎉 Kết nối Redis thành công!")
    except redis.ConnectionError:
        print("❌ Không thể kết nối Redis. Hãy kiểm tra lại Server.")