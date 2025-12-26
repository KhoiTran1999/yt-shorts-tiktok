import React, { useState, useRef, useEffect, useMemo } from 'react';
import YouTube from 'react-youtube';
import { FaPlay, FaVolumeMute, FaClosedCaptioning } from 'react-icons/fa';

const VideoCard = ({ video, isActive, onEnded, index, isCaptionOn, onToggleCaption }) => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(index === 0);
  const [isReady, setIsReady] = useState(false);

  const playerRef = useRef(null);

  // --- HÀM AN TOÀN: Kiểm tra DOM trước khi gọi YouTube API ---
  const safePlayerCall = (action) => {
    const player = playerRef.current;
    if (!player) return;

    try {
      // Quan trọng: Kiểm tra xem iframe có còn kết nối với trang web không
      const iframe = player.getIframe();
      if (iframe && iframe.isConnected) {
        if (action === 'play') player.playVideo();
        if (action === 'pause') player.pauseVideo();
        if (action === 'mute') player.mute();
        if (action === 'unmute') player.unMute();
      }
    } catch (error) {
      console.warn("YouTube Player Error (Ignored):", error);
    }
  };
  // ----------------------------------------------------------

  const opts = useMemo(() => ({
    height: '100%',
    width: '100%',
    playerVars: {
      autoplay: 0,
      controls: 0,
      rel: 0,
      showinfo: 0,
      modestbranding: 1,
      disablekb: 1,
      fs: 0,
      cc_load_policy: isCaptionOn ? 1 : 0, 
      origin: window.location.origin,
    },
  }), [isCaptionOn]);

  const onReady = (event) => {
    playerRef.current = event.target;
    setIsReady(true);

    if (index === 0) {
      safePlayerCall('mute');
      setIsMuted(true);
    } else {
      safePlayerCall('unmute');
      setIsMuted(false);
    }

    if (isActive) {
      safePlayerCall('play');
    }
  };

  const onStateChange = (event) => {
    // Nếu video đã kết thúc và đang active -> Gọi callback để next slide
    if (event.data === 0 && isActive && onEnded) onEnded();
    if (event.data === 1) setIsPlaying(true);
    if (event.data === 2) setIsPlaying(false);
  };

  // useEffect: Xử lý khi lướt qua lại
  useEffect(() => {
    if (!playerRef.current) return;

    if (isActive) {
      safePlayerCall('play');
      setIsPlaying(true);
    } else {
      safePlayerCall('pause');
      setIsPlaying(false);
    }
  }, [isActive]);

  const togglePlay = () => {
    if (!playerRef.current) return;

    if (isMuted) {
      safePlayerCall('unmute');
      setIsMuted(false);
    } else {
      // Nếu đang play thì pause, đang pause thì play
      if (isPlaying) {
        safePlayerCall('pause');
      } else {
        safePlayerCall('play');
      }
    }
  };

  const handleToggleCaptions = (e) => {
    e.stopPropagation(); 
    if (onToggleCaption) onToggleCaption();
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
        // Thêm loading="lazy" để tối ưu
        loading="lazy"
      />

      {/* Button CC */}
      {isReady && (
        <button 
          onClick={handleToggleCaptions}
          style={{
            position: 'absolute', top: 20, left: 20, zIndex: 50,
            background: isCaptionOn ? 'rgba(254, 44, 85, 0.8)' : 'rgba(0, 0, 0, 0.4)',
            border: '1px solid rgba(255,255,255,0.3)', borderRadius: '4px',
            color: 'white', padding: '5px 8px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '5px',
            fontSize: '12px', fontWeight: 'bold', transition: 'all 0.2s'
          }}
        >
          <FaClosedCaptioning size={16} />
          {isCaptionOn ? 'ON' : 'OFF'}
        </button>
      )}

      {/* Icon Mute */}
      {isMuted && isActive && isPlaying && (
        <div className="play-icon-overlay">
          <FaVolumeMute size={40} color="white" style={{ opacity: 0.8 }} />
        </div>
      )}

      {/* Icon Play */}
      {isReady && !isPlaying && isActive && !isMuted && (
        <div className="play-icon-overlay">
          <FaPlay size={50} color="white" style={{ opacity: 0.8 }} />
        </div>
      )}

      <div className="video-info">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <img 
            src={video.channel_avatar || "https://via.placeholder.com/150"} 
            alt="Channel"
            style={{ width: '40px', height: '40px', borderRadius: '50%', border: '1px solid white', objectFit: 'cover' }} 
          />
          <h4 style={{ margin: 0, fontSize: '16px', color: '#fff', textShadow: '1px 1px 2px black', fontWeight: 'bold' }}>
             {video.channel_name || "Channel"}
          </h4>
        </div>
        <p className="video-title" style={{ margin: 0, fontSize: '14px', fontWeight: 'normal', textShadow: '1px 1px 2px black', lineHeight: '1.4' }}>
           {video.title}
        </p>
      </div>
    </div>
  );
};

export default VideoCard;