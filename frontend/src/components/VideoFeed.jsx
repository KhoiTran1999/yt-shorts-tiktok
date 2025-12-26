// frontend/src/components/VideoFeed.jsx
import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Mousewheel, Keyboard, Virtual } from 'swiper/modules';
import YouTube from 'react-youtube';

import 'swiper/css';
import 'swiper/css/virtual';

import VideoCard from './VideoCard';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const generateSessionId = () => Math.random().toString(36).substring(2) + Date.now().toString(36);

const VideoFeed = ({ userId, isCaptionOn, onToggleCaption, isMutedGlobal, onToggleMuteGlobal }) => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const sessionIdRef = useRef(generateSessionId());
  
  // --- SINGLE PLAYER STATE ---
  const playerRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false); // Trạng thái play thực tế của Player
  const [isVideoLoaded, setIsVideoLoaded] = useState(false); // Để ẩn hiện thumbnail
  const [hasCountedView, setHasCountedView] = useState(false);

  // Load video list
  const fetchVideos = async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      let url = `${API_BASE_URL}/api/feed?limit=5&session_id=${sessionIdRef.current}`;
      if (userId) url += `&user_id=${userId}`;
      const res = await axios.get(url);
      if (res.data.length === 0) setHasMore(false);
      else setVideos(prev => [...prev, ...res.data]);
    } catch (e) { console.error(e); } 
    finally { setLoading(false); }
  };

  useEffect(() => {
    setVideos([]); setHasMore(true);
    sessionIdRef.current = generateSessionId();
    fetchVideos();
  }, [userId]);

  // --- PLAYER CONTROLLER ---
  
  // 1. Khi lướt sang video mới
  const handleSlideChange = (swiper) => {
    const newIndex = swiper.activeIndex;
    setActiveIndex(newIndex);
    
    // Reset trạng thái view
    setHasCountedView(false);
    setIsVideoLoaded(false); 

    // Nếu có video, nạp vào Player ngay
    if (videos[newIndex] && playerRef.current) {
        playerRef.current.loadVideoById(videos[newIndex].id);
        
        // AUTO UNMUTE LOGIC (QUAN TRỌNG)
        // Nếu user đã từng unmute (isMutedGlobal = false), video sau sẽ tự có tiếng
        if (!isMutedGlobal) {
             playerRef.current.unMute();
        }
    }

    // Load thêm video khi gần hết
    if (newIndex >= videos.length - 2 && hasMore && !loading) {
      fetchVideos();
    }
  };

  // 2. Xử lý sự kiện Player
  const onPlayerReady = (event) => {
    playerRef.current = event.target;
    // Bắt đầu video đầu tiên
    if (videos.length > 0) {
        event.target.loadVideoById(videos[0].id);
        if(isMutedGlobal) event.target.mute();
    }
  };

  const onPlayerStateChange = (event) => {
    // 1: Playing, 2: Paused, 3: Buffering
    if (event.data === 1) {
        setIsPlaying(true);
        setIsVideoLoaded(true); // Ẩn thumbnail đi
    } else if (event.data === 2) {
        setIsPlaying(false);
    } else if (event.data === 0) {
       // Ended -> Next slide
       const swiper = document.querySelector('.mySwiper').swiper;
       if(swiper) swiper.slideNext();
    }
  };

  // 3. Logic đếm view (Thay thế logic cũ trong VideoCard)
  useEffect(() => {
    let interval;
    if (isPlaying && !hasCountedView && videos[activeIndex]) {
        interval = setInterval(() => {
            if (playerRef.current && playerRef.current.getCurrentTime() >= 15) {
                axios.post(`${API_BASE_URL}/api/view/${videos[activeIndex].id}`).catch(()=>{});
                setHasCountedView(true);
                clearInterval(interval);
            }
        }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, hasCountedView, activeIndex, videos]);

  // 4. Toggle Play/Mute khi bấm vào màn hình
  const handleScreenClick = () => {
    const player = playerRef.current;
    if (!player) return;

    if (isMutedGlobal) {
        // Cú click đầu tiên: Unmute toàn bộ
        onToggleMuteGlobal(false);
        player.unMute();
        player.setVolume(100);
        player.playVideo(); // Đảm bảo chạy
    } else {
        // Các lần sau: Toggle Pause/Play
        if (isPlaying) player.pauseVideo();
        else player.playVideo();
    }
  };

  // Cấu hình Player
  const playerOpts = {
    height: '100%', width: '100%',
    playerVars: { autoplay: 1, controls: 0, playsinline: 1, rel: 0, disablekb: 1, fs: 0, modestbranding: 1 }
  };

  return (
    <div className="video-feed">
       {/* === LAYER 1: SINGLE PLAYER BACKGROUND === */}
       <div id="youtube-background-layer">
          <YouTube 
            opts={playerOpts}
            onReady={onPlayerReady}
            onStateChange={onPlayerStateChange}
            className="video-iframe" // CSS: width 100%, height 100%
          />
       </div>

       {/* === LAYER 2: SWIPER (UI & THUMBNAILS) === */}
       <Swiper
        modules={[Mousewheel, Keyboard, Virtual]}
        direction={'vertical'}
        slidesPerView={1}
        className="mySwiper"
        onSlideChange={handleSlideChange}
        virtual={{ enabled: true, addSlidesBefore: 1, addSlidesAfter: 1 }}
      >
        {videos.map((video, index) => (
          <SwiperSlide key={`${video.id}-${index}`} virtualIndex={index}>
            <VideoCard 
                video={video}
                isActive={index === activeIndex}
                isGlobalPlaying={isPlaying}
                isMutedGlobal={isMutedGlobal}
                isVideoLoaded={isVideoLoaded && index === activeIndex} // Chỉ ẩn thumbnail của slide đang chạy
                onTogglePlay={handleScreenClick}
                isCaptionOn={isCaptionOn}
                onToggleCaption={onToggleCaption}
            />
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );
};

export default VideoFeed;