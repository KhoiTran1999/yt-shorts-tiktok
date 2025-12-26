// frontend/src/components/VideoFeed.jsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Mousewheel, Keyboard } from 'swiper/modules';
import 'swiper/css';
import VideoCard from './VideoCard';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// Nhận thêm props Mute
const VideoFeed = ({ userId, isCaptionOn, onToggleCaption, isMutedGlobal, onToggleMuteGlobal }) => {
  const [videos, setVideos] = useState([]);
  const [swiperInstance, setSwiperInstance] = useState(null);
  
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const fetchVideos = async (pageToLoad, isReset = false) => {
    if (loading) return; 
    setLoading(true);

    try {
      const limit = 5; 
      const url = userId 
          ? `${API_BASE_URL}/api/feed?user_id=${userId}&page=${pageToLoad}&limit=${limit}`
          : `${API_BASE_URL}/api/feed?page=${pageToLoad}&limit=${limit}`;
          
      const response = await axios.get(url);
      const newVideos = response.data;

      if (newVideos.length === 0) {
        setHasMore(false); 
      } else {
        setVideos(prev => isReset ? newVideos : [...prev, ...newVideos]);
      }
    } catch (error) {
      console.error("Lỗi lấy dữ liệu:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setVideos([]);
    setPage(1);
    setHasMore(true);
    fetchVideos(1, true); 
  }, [userId]);

  const handleSlideChange = (swiper) => {
    if (swiper.activeIndex >= videos.length - 2 && hasMore && !loading) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchVideos(nextPage, false);
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
        direction={'vertical'}
        slidesPerView={1}
        mousewheel={true}
        keyboard={true}
        modules={[Mousewheel, Keyboard]}
        className="mySwiper"
        onSwiper={setSwiperInstance}
        onSlideChange={handleSlideChange}
      >
        {videos.map((video, index) => (
          <SwiperSlide key={`${video.id}-${index}`}>
            {({ isActive }) => (
                <VideoCard 
                  video={video} 
                  isActive={isActive} 
                  onEnded={handleVideoEnded}
                  index={index}
                  
                  // --- TRUYỀN TIẾP XUỐNG CARD ---
                  isCaptionOn={isCaptionOn} 
                  onToggleCaption={onToggleCaption}
                  isMutedGlobal={isMutedGlobal}
                  onToggleMuteGlobal={onToggleMuteGlobal}
                />
            )}
          </SwiperSlide>
        ))}
      </Swiper>
      
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