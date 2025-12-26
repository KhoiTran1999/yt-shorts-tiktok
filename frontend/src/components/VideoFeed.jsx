// frontend/src/components/VideoFeed.jsx
import React, { useEffect, useState, useRef } from 'react'; // Nhớ import useRef
import axios from 'axios';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Mousewheel, Keyboard, Virtual } from 'swiper/modules'; 

import 'swiper/css';
import 'swiper/css/virtual'; 

import VideoCard from './VideoCard';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// Hàm tạo Session ID (Dùng cho logic backend phân phát video không trùng)
const generateSessionId = () => Math.random().toString(36).substring(2) + Date.now().toString(36);

const VideoFeed = ({ userId, isCaptionOn, onToggleCaption, isMutedGlobal, onToggleMuteGlobal }) => {
  const [videos, setVideos] = useState([]);
  const [swiperInstance, setSwiperInstance] = useState(null);
  
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  
  // Dùng Session ID để backend biết người này đang xem dở list nào
  const sessionIdRef = useRef(generateSessionId());

  const fetchVideos = async () => {
    if (loading || !hasMore) return; 
    setLoading(true);

    try {
      const limit = 5; 
      // Gửi session_id lên để backend không trả lại video cũ
      let url = `${API_BASE_URL}/api/feed?limit=${limit}&session_id=${sessionIdRef.current}`;
      if (userId) url += `&user_id=${userId}`;
          
      const response = await axios.get(url);
      const newVideos = response.data;

      if (newVideos.length === 0) {
        setHasMore(false); 
      } else {
        setVideos(prev => [...prev, ...newVideos]);
      }
    } catch (error) {
      console.error("Lỗi lấy dữ liệu:", error);
    } finally {
      setLoading(false);
    }
  };

  // Reset khi đổi user
  useEffect(() => {
    setVideos([]);
    setHasMore(true);
    sessionIdRef.current = generateSessionId(); // Tạo session mới
    fetchVideos(); 
  }, [userId]);

const handleSlideChange = (swiper) => {
    // [LOGIC PWA MỚI] 
    // Nếu người dùng lướt sang video khác (activeIndex > 0) và đang bị Mute global
    // thì tự động mở tiếng cho toàn bộ App.
    // Hành động "vuốt" được tính là tương tác người dùng, trình duyệt sẽ cho phép phát tiếng.
    if (swiper.activeIndex > 0 && isMutedGlobal) {
        if (onToggleMuteGlobal) onToggleMuteGlobal(false);
    }

    // Load thêm khi còn cách cuối 2 video
    if (swiper.activeIndex >= videos.length - 2 && hasMore && !loading) {
      fetchVideos();
    }
  };

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
        modules={[Mousewheel, Keyboard, Virtual]} 
        direction={'vertical'}
        slidesPerView={1}
        mousewheel={true}
        keyboard={true}
        className="mySwiper"
        onSwiper={setSwiperInstance}
        onSlideChange={handleSlideChange}
        // [QUAN TRỌNG] Giảm bộ đệm xuống 1 để tránh tràn RAM gây đen màn hình
        virtual={{
            enabled: true,
            addSlidesBefore: 1, 
            addSlidesAfter: 1,  
        }}
      >
        {videos.map((video, index) => (
          <SwiperSlide key={`${video.id}-${index}`} virtualIndex={index}>
            {({ isActive }) => (
                <VideoCard 
                  video={video} 
                  isActive={isActive} 
                  onEnded={handleVideoEnded}
                  index={index}
                  isCaptionOn={isCaptionOn} 
                  onToggleCaption={onToggleCaption}
                  isMutedGlobal={isMutedGlobal}
                  onToggleMuteGlobal={onToggleMuteGlobal}
                />
            )}
          </SwiperSlide>
        ))}
      </Swiper>
      
      {loading && (
        <div style={{
            position: 'absolute', bottom: 10, left: 0, right: 0, 
            textAlign: 'center', color: 'rgba(255,255,255,0.5)', 
            zIndex: 100, fontSize: '12px', pointerEvents: 'none'
        }}>
            Đang tải thêm...
        </div>
      )}
    </div>
  );
};

export default VideoFeed;