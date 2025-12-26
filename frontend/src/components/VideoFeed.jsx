// frontend/src/components/VideoFeed.jsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Mousewheel, Keyboard } from 'swiper/modules';
import 'swiper/css';
import VideoCard from './VideoCard';

const VideoFeed = ({ userId }) => {
  const [videos, setVideos] = useState([]);
  const [swiperInstance, setSwiperInstance] = useState(null); // 1. Tạo biến lưu điều khiển Swiper

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const url = userId 
            ? `http://localhost:8000/api/feed?user_id=${userId}`
            : 'http://localhost:8000/api/feed';
        const response = await axios.get(url);
        setVideos(response.data);
        console.log("Videos loaded:", response.data);
        
      } catch (error) {
        console.error("Lỗi lấy dữ liệu:", error);
      }
    };
    fetchVideos();
  }, [userId]);

  // 2. Hàm xử lý khi video hết -> Gọi Swiper lướt xuống
  const handleVideoEnded = () => {
    if (swiperInstance) {
      swiperInstance.slideNext(); // Lệnh thần thánh để lướt
    }
  };

  return (
    <div className="video-feed">
      <Swiper
        direction={'vertical'}
        slidesPerView={1}
        mousewheel={true}
        keyboard={true}
        modules={[Mousewheel, Keyboard]}
        className="mySwiper"
        onSwiper={(swiper) => setSwiperInstance(swiper)} // 3. Gắn điều khiển vào biến
      >
        {videos.map((video, index) => ( // <--- Lấy thêm index ở đây
          <SwiperSlide key={video.id}>
            {({ isActive }) => (
                <VideoCard 
                  video={video} 
                  isActive={isActive} 
                  onEnded={handleVideoEnded}
                  index={index} // <--- TRUYỀN INDEX XUỐNG
                />
            )}
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );
};

export default VideoFeed;