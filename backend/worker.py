import scrapetube
import requests
import re
import json
import time
from database import add_video_to_db, add_channel_to_db

# === 1. HÀM CỨU VIỆN (GỌI OEMBED) ===
def fetch_video_info_fallback(video_id):
    """
    Khi scrapetube không trả về title, dùng hàm này để hỏi trực tiếp YouTube.
    API: oEmbed (Công khai, không cần key, rất nhanh)
    """
    try:
        # URL chuẩn để hỏi info video
        url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
        
        response = requests.get(url, timeout=5)
        if response.status_code == 200:
            data = response.json()
            return {
                "title": data.get("title"),
                "author_name": data.get("author_name"), # Tiện thể lấy luôn tên kênh chuẩn
                "author_url": data.get("author_url")
            }
    except Exception as e:
        print(f"⚠️ Lỗi gọi oEmbed cho video {video_id}: {e}")
    
    return None

# === 2. HÀM TÌM TEXT ĐỆ QUY (GIỮ LẠI) ===
def find_text_recursive(data, target_keys=['text', 'simpleText', 'label']):
    found_texts = []
    if isinstance(data, dict):
        for k, v in data.items():
            if k in target_keys and isinstance(v, str):
                if len(v) > 5 and not v.replace(':', '').isdigit(): 
                    found_texts.append(v)
            elif isinstance(v, (dict, list)):
                found_texts.extend(find_text_recursive(v, target_keys))
    elif isinstance(data, list):
        for item in data:
            found_texts.extend(find_text_recursive(item, target_keys))
    return found_texts

# === 3. HÀM TRÍCH XUẤT TIÊU ĐỀ (LOGIC MỚI) ===
def extract_video_info(video):
    """
    Trả về (title, channel_name_fallback)
    """
    video_id = video.get('videoId')
    title = None

    # CÁCH 1: Tìm trong JSON có sẵn (Nhanh nhất)
    try:
        if 'headline' in video: title = video['headline']['runs'][0]['text']
        elif 'title' in video:
            if 'runs' in video['title']: title = video['title']['runs'][0]['text']
            elif 'simpleText' in video['title']: title = video['title']['simpleText']
    except: pass

    # CÁCH 2: Vét cạn recursive
    if not title:
        candidates = find_text_recursive(video)
        if candidates: title = max(candidates, key=len)

    # CÁCH 3: GỌI CỨU VIỆN (Nếu Cách 1 & 2 thất bại)
    if not title or title == "Unknown Title":
        print(f"🔦 Đang gọi API oEmbed để lấy info cho: {video_id}...")
        fallback_data = fetch_video_info_fallback(video_id)
        if fallback_data and fallback_data.get("title"):
            return fallback_data["title"]

    return title if title else "Unknown Title"

# === 4. CÁC HÀM HỖ TRỢ KHÁC ===
def get_channel_details(channel_id):
    url = f"https://www.youtube.com/channel/{channel_id}"
    print(f"🔄 Đang cập nhật info kênh: {url}")
    try:
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "Accept-Language": "en-US"}
        response = requests.get(url, headers=headers, timeout=10)
        html = response.text
        
        # 1. Lấy Tên
        channel_name = f"Channel {channel_id}"
        name_match = re.search(r'<meta property="og:title" content="(.*?)">', html)
        if name_match: channel_name = name_match.group(1)
        
        # 2. Lấy Avatar
        avatar_url = "https://via.placeholder.com/150"
        avatar_match = re.search(r'<meta property="og:image" content="(.*?)">', html)
        if avatar_match: avatar_url = avatar_match.group(1)

        # 3. Lấy Mô tả (Nâng cấp)
        description = ""
        
        # Cách 1: Thử tìm trong JSON (Thường chứa full text nhất)
        json_match = re.search(r'"description":\{"simpleText":"(.*?)"\}', html)
        if json_match:
            # Giải mã ký tự xuống dòng của JSON
            description = json_match.group(1).replace('\\n', '\n')
        
        # Cách 2: Nếu không có JSON, dùng thẻ Meta (Thêm re.DOTALL để lấy xuống dòng)
        if not description:
            desc_match = re.search(r'<meta property="og:description" content="(.*?)">', html, re.DOTALL)
            if desc_match: description = desc_match.group(1)
        
        # Cleanup: Xóa các ký tự thừa nếu có
        if description:
            description = description.replace('&quot;', '"').replace('&#39;', "'")

        return channel_name, avatar_url, description
    except Exception as e:
        print(f"⚠️ Lỗi lấy info kênh {channel_id}: {e}")
        return f"Channel {channel_id}", "https://via.placeholder.com/150", ""

def get_channel_id_from_url(url):
    try:
        headers = {"User-Agent": "Mozilla/5.0"}
        response = requests.get(url, headers=headers, timeout=10)
        match = re.search(r'"browseId":"(UC[\w-]+)"', response.text)
        if match: return match.group(1)
        match = re.search(r'itemprop="identifier" content="(UC[\w-]+)"', response.text)
        if match: return match.group(1)
        return None
    except: return None

# === 5. WORKER CHÍNH ===
def sync_channel_data(channel_id, limit=100):
    """Hàm cốt lõi: Quét video từ ID kênh và lưu vào DB"""
    print(f"🚀 Worker: Bắt đầu quét video kênh {channel_id}...")
    try:
        # Lấy số video mới nhất theo limit
        videos = scrapetube.get_channel(channel_id=channel_id, content_type="shorts", sleep=1, limit=limit)
        count = 0
        for video in videos:
            try:
                if 'videoId' not in video: continue
                video_id = video['videoId']
                
                title = extract_video_info(video)
                thumbnail_url = f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"
                
                if title == "Unknown Title": continue

                add_video_to_db(channel_id, video_id, title, thumbnail_url)
                count += 1
            except Exception as e: 
                continue
    except Exception as e:
        print(f"⚠️ Worker: Lỗi khi cào video: {e}")

    print(f"✅ Worker: Quét xong {count} video cho kênh {channel_id}.")

    # Cập nhật lại Avatar/Tên/Mô tả 
    new_name, new_avatar, new_desc = get_channel_details(channel_id)
    # Gọi hàm DB mới có thêm tham số description
    add_channel_to_db(channel_id, new_name, new_avatar, new_desc)
    
    return True

def sync_full_channel(channel_url):
    """Dùng cho lúc Add Channel (Có URL)"""
    real_channel_id = get_channel_id_from_url(channel_url)
    if not real_channel_id:
        print(f"❌ Worker: Không lấy được ID từ {channel_url}")
        return
    
    # Gọi hàm chung
    sync_channel_data(real_channel_id)
    return real_channel_id

def sync_channel_by_id(channel_id):
    """Dùng cho lúc Reload (Chỉ có ID)"""
    sync_channel_data(channel_id)


