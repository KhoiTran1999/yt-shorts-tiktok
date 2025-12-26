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
  const [isVideoLoaded, setIsVideoLoaded] = useState(false); // Biến quan trọng để hiển thị loading
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
  
  const handleSlideChange = (swiper) => {
    const newIndex = swiper.activeIndex;
    setActiveIndex(newIndex);
    
    // Reset ngay lập tức khi lướt sang video mới
    setHasCountedView(false);
    setIsVideoLoaded(false); // -> VideoCard sẽ hiện Spinner ngay lúc này

    if (videos[newIndex] && playerRef.current) {
        playerRef.current.loadVideoById(videos[newIndex].id);
        if (!isMutedGlobal) playerRef.current.unMute();
    }

    if (newIndex >= videos.length - 2 && hasMore && !loading) {
      fetchVideos();
    }
  };

  // [MỚI] Hàm xử lý tua video (+/- 5s)
  const handleSeek = (seconds) => {
      const player = playerRef.current;
      if (player && typeof player.seekTo === 'function') {
          // getCurrentTime() trả về giây
          const currentTime = player.getCurrentTime();
          player.seekTo(currentTime + seconds, true);
      }
  };

  const onPlayerReady = (event) => {
    playerRef.current = event.target;
    if (videos.length > 0) {
        event.target.loadVideoById(videos[0].id);
        if(isMutedGlobal) event.target.mute();
    }
  };

  const onPlayerStateChange = (event) => {
    if (event.data === 1) { // Playing
        setIsPlaying(true);
        setIsVideoLoaded(true); // -> VideoCard sẽ ẩn Spinner, hiện nút Pause (nếu cần)
    } else if (event.data === 2) { // Paused
        setIsPlaying(false);
    } else if (event.data === 0) { // Ended
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

  const playerOpts = {
    height: '100%', width: '100%',
    playerVars: { autoplay: 1, controls: 0, playsinline: 1, rel: 0, disablekb: 1, fs: 0, modestbranding: 1 }
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
                onSeek={handleSeek} // [MỚI] Truyền hàm seek xuống
            />
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );
};

export default VideoFeed;