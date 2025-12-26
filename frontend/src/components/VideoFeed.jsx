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
  const [isPlaying, setIsPlaying] = useState(false); 
  const [isVideoLoaded, setIsVideoLoaded] = useState(false); 
  const [hasCountedView, setHasCountedView] = useState(false);

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

  useEffect(() => {
    // Chỉ chạy khi đã có video và Player đã sẵn sàng
    if (videos.length > 0 && playerRef.current) {
        // Kiểm tra xem Player đã đang chạy video nào chưa để tránh load lại
        const playerState = playerRef.current.getPlayerState();
        
        // Nếu Player chưa bắt đầu (unstarted: -1) hoặc đang chờ (cued: 5)
        // Lưu ý: activeIndex phải là 0 (người dùng chưa cuộn đi đâu)
        if ((playerState === -1 || playerState === 5) && activeIndex === 0) {
            playerRef.current.loadVideoById(videos[0].id);
            if (isMutedGlobal) {
                playerRef.current.mute();
            } else {
                playerRef.current.unMute();
            }
        }
    }
  }, [videos]); // Chạy lại mỗi khi danh sách video thay đổi

  // --- PLAYER CONTROLLER ---
  
  // [FIX CAPTION 1] Lắng nghe sự kiện bật/tắt caption để điều khiển Player
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    // YouTube API: loadModule('captions') để bật, unloadModule để tắt
    if (isCaptionOn) {
        if (typeof player.loadModule === 'function') {
            player.loadModule('captions');  
        }
    } else {
        if (typeof player.unloadModule === 'function') {
            player.unloadModule('captions');
        }
    }
  }, [isCaptionOn]); // Chạy lại mỗi khi user bấm nút Caption

  const handleSlideChange = (swiper) => {
    const newIndex = swiper.activeIndex;
    setActiveIndex(newIndex);
    setHasCountedView(false);
    setIsVideoLoaded(false);

    if (videos[newIndex] && playerRef.current) {
        playerRef.current.loadVideoById(videos[newIndex].id);
        if (!isMutedGlobal) playerRef.current.unMute();
    }

    if (newIndex >= videos.length - 2 && hasMore && !loading) {
      fetchVideos();
    }
  };

  const handleSeek = (seconds) => {
      const player = playerRef.current;
      if (player && typeof player.seekTo === 'function') {
          player.seekTo(player.getCurrentTime() + seconds, true);
      }
  };

  const onPlayerReady = (event) => {
    playerRef.current = event.target;
    
    // [FIX CAPTION 2] Đồng bộ trạng thái caption ngay khi player vừa load xong
    if (isCaptionOn) {
         if (typeof event.target.loadModule === 'function') event.target.loadModule('captions');
    } else {
         if (typeof event.target.unloadModule === 'function') event.target.unloadModule('captions');
    }

    if (videos.length > 0) {
        event.target.loadVideoById(videos[0].id);
        if(isMutedGlobal) event.target.mute();
    }
  };

  const onPlayerStateChange = (event) => {
    if (event.data === 1) { 
        setIsPlaying(true);
        setIsVideoLoaded(true);
    } else if (event.data === 2) { 
        setIsPlaying(false);
    } else if (event.data === 0) { 
       const swiper = document.querySelector('.mySwiper').swiper;
       if(swiper) swiper.slideNext();
    }
  };

  useEffect(() => {
    let interval;
    if (isPlaying && !hasCountedView && videos[activeIndex]) {
        interval = setInterval(() => {
            if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
                if (playerRef.current.getCurrentTime() >= 15) {
                    axios.post(`${API_BASE_URL}/api/view/${videos[activeIndex].id}`).catch(()=>{});
                    setHasCountedView(true);
                    clearInterval(interval);
                }
            }
        }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, hasCountedView, activeIndex, videos]);

  const handleScreenClick = () => {
    const player = playerRef.current;
    if (!player) return;

    if (isMutedGlobal) {
        onToggleMuteGlobal(false);
        player.unMute();
        player.setVolume(100);
        player.playVideo(); 
    } else {
        if (isPlaying) player.pauseVideo();
        else player.playVideo();
    }
  };

  // [FIX CAPTION 3] Thêm cc_load_policy vào playerVars
  const playerOpts = {
    height: '100%', width: '100%',
    playerVars: { 
        autoplay: 1, 
        controls: 0, 
        playsinline: 1, 
        rel: 0, 
        disablekb: 1, 
        fs: 0, 
        modestbranding: 1,
        cc_load_policy: 1, // BẮT BUỘC: Cho phép load module caption
        iv_load_policy: 3  // Ẩn các annotation (ghi chú) của video cho đỡ rối
    }
  };

  return (
    <div className="video-feed">
       <div id="youtube-background-layer">
          <YouTube 
            opts={playerOpts}
            onReady={onPlayerReady}
            onStateChange={onPlayerStateChange}
            className="video-iframe" 
          />
       </div>

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
                isVideoLoaded={isVideoLoaded && index === activeIndex} 
                onTogglePlay={handleScreenClick}
                isCaptionOn={isCaptionOn}
                onToggleCaption={onToggleCaption}
                onSeek={handleSeek}
            />
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );
};

export default VideoFeed;