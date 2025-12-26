import React, { useState, useRef, useEffect, useMemo } from 'react';
import YouTube from 'react-youtube';
import { FaPlay, FaVolumeMute } from 'react-icons/fa';

const VideoCard = ({ video, isActive, onEnded, index }) => {
  const [isPlaying, setIsPlaying] = useState(false); // Mặc định là false để tránh icon Play nháy sai
  
  // Chỉ video đầu tiên (index 0) mới bị Mute mặc định để trình duyệt cho phép tự chạy
  const [isMuted, setIsMuted] = useState(index === 0); 
  
  const playerRef = useRef(null);

  const opts = useMemo(() => ({
    height: '100%',
    width: '100%',
    playerVars: {
      autoplay: 0, // <--- SỬA QUAN TRỌNG: Tắt tự chạy của iframe. Để React tự lo.
      controls: 0,
      rel: 0,
      showinfo: 0,
      modestbranding: 1,
      disablekb: 1,
      fs: 0,
      origin: window.location.origin,
    },
  }), []);

  const onReady = (event) => {
    playerRef.current = event.target;
    
    // Logic Mute
    if (index === 0) {
      event.target.mute();
      setIsMuted(true);
    } else {
      event.target.unMute();
      setIsMuted(false);
    }

    // Logic Play: Chỉ play nếu slide này đang Active
    if (isActive) {
      event.target.playVideo();
      setIsPlaying(true);
    }
  };

  const onStateChange = (event) => {
    // ENDED (0)
    if (event.data === 0) { 
      if (isActive && onEnded) onEnded();
    }
    // PLAYING (1)
    if (event.data === 1) setIsPlaying(true);
    // PAUSED (2)
    if (event.data === 2) setIsPlaying(false);
  };

  // useEffect này cực kỳ quan trọng:
  // Nó giám sát việc lướt lên/xuống. 
  // Nếu isActive = false (lướt đi chỗ khác) -> Lập tức Pause ngay.
  useEffect(() => {
    if (!playerRef.current) return;

    if (isActive) {
      playerRef.current.playVideo();
    } else {
      playerRef.current.pauseVideo();
    }
  }, [isActive]);

  const togglePlay = () => {
    if (!playerRef.current) return;

    if (isMuted) {
      playerRef.current.unMute();
      setIsMuted(false);
    } else {
      if (isPlaying) {
        playerRef.current.pauseVideo();
      } else {
        playerRef.current.playVideo();
      }
    }
  };

  return (
    <div className="video-card" onClick={togglePlay}>
      <YouTube
        videoId={video.id}
        opts={opts}
        onReady={onReady}
        onStateChange={onStateChange}
        className="video-iframe"
        iframeClassName="video-iframe"
      />

      {isMuted && isActive && isPlaying && (
        <div className="play-icon-overlay">
          <FaVolumeMute size={40} color="white" style={{ opacity: 0.8 }} />
          <p style={{color: 'white', marginTop: '10px', fontWeight: 'bold', textShadow: '1px 1px 2px black'}}>Bấm để bật tiếng</p>
        </div>
      )}

      {/* Logic hiện nút Play: Chỉ hiện khi ĐÃ SẴN SÀNG (playerRef có) và ĐANG PAUSE */}
      {!isPlaying && isActive && !isMuted && playerRef.current && (
        <div className="play-icon-overlay">
          <FaPlay size={50} color="white" style={{ opacity: 0.8 }} />
        </div>
      )}

      <div className="video-info">
        <h4 style={{ margin: '0 0 5px 0', fontSize: '15px', color: '#eee', textShadow: '1px 1px 2px black' }}>
           {video.channel_name || "Channel"}
        </h4>
        <p className="video-title" style={{ margin: 0, fontSize: '14px', fontWeight: 'normal', textShadow: '1px 1px 2px black' }}>
           {video.title}
        </p>
      </div>
    </div>
  );
};

export default VideoCard;