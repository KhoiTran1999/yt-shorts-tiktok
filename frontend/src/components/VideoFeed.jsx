import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Mousewheel, Keyboard } from 'swiper/modules';
import 'swiper/css';
import VideoCard from './VideoCard';

const VideoFeed = ({ userId }) => {
  const [videos, setVideos] = useState([]);
  const [swiperInstance, setSwiperInstance] = useState(null);
  
  // --- STATE QUẢN LÝ PHÂN TRANG ---
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true); // Kiểm tra còn video để tải không

  // Hàm gọi API load video (Có hỗ trợ phân trang)
  const fetchVideos = async (pageToLoad, isReset = false) => {
    if (loading) return; // Chặn gọi trùng lặp
    setLoading(true);

    try {
      // Mỗi lần tải 5 video để nhẹ máy
      const limit = 5; 
      const url = userId 
          ? `http://localhost:8000/api/feed?user_id=${userId}&page=${pageToLoad}&limit=${limit}`
          : `http://localhost:8000/api/feed?page=${pageToLoad}&limit=${limit}`;
          
      const response = await axios.get(url);
      const newVideos = response.data;

      if (newVideos.length === 0) {
        setHasMore(false); // Hết video trong database
      } else {
        // Nếu là reset (đổi user) thì thay mới hoàn toàn, ngược lại thì nối thêm vào đuôi
        setVideos(prev => isReset ? newVideos : [...prev, ...newVideos]);
      }
    } catch (error) {
      console.error("Lỗi lấy dữ liệu:", error);
    } finally {
      setLoading(false);
    }
  };

  // 1. Khi User thay đổi -> Reset lại từ đầu (Trang 1)
  useEffect(() => {
    setVideos([]);
    setPage(1);
    setHasMore(true);
    fetchVideos(1, true); // true = Xóa list cũ
  }, [userId]);

  // 2. LOGIC QUAN TRỌNG: Tự động tải thêm khi lướt
  const handleSlideChange = (swiper) => {
    // Nếu lướt đến video thứ (Tổng - 2) và vẫn còn hàng thì tải tiếp trang sau
    if (swiper.activeIndex >= videos.length - 2 && hasMore && !loading) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchVideos(nextPage, false);
    }
  };

  // Tự động lướt khi hết video
  const handleVideoEnded = () => {
    if (swiperInstance) {
      swiperInstance.slideNext();
    }
  };

  return (
    <div className="video-feed">
      {videos.length === 0 && !loading && (
        <div style={{color:'white', textAlign:'center', marginTop:'50%'}}>
            Không có video nào. Hãy thêm kênh mới!
        </div>
      )}

      <Swiper
        direction={'vertical'}
        slidesPerView={1}
        mousewheel={true}
        keyboard={true}
        modules={[Mousewheel, Keyboard]}
        className="mySwiper"
        onSwiper={setSwiperInstance}
        onSlideChange={handleSlideChange} // <--- Kích hoạt logic tải thêm ở đây
      >
        {videos.map((video, index) => (
          // Dùng key kết hợp index để tránh lỗi trùng lặp ID nếu có
          <SwiperSlide key={`${video.id}-${index}`}>
            {({ isActive }) => (
                <VideoCard 
                  video={video} 
                  isActive={isActive} 
                  onEnded={handleVideoEnded}
                  index={index}
                />
            )}
          </SwiperSlide>
        ))}
      </Swiper>
      
      {/* Hiển thị chữ Loading nhỏ ở góc dưới khi đang tải ngầm */}
      {loading && videos.length > 0 && (
        <div style={{
            position: 'absolute', bottom: 10, left: 0, right: 0, 
            textAlign: 'center', color: 'rgba(255,255,255,0.5)', 
            zIndex: 100, fontSize: '12px', pointerEvents: 'none'
        }}>
            Loading more...
        </div>
      )}
    </div>
  );
};

export default VideoFeed;