// frontend/src/components/VideoCard.jsx
import React, { useState, useRef, useEffect, useMemo } from 'react';
import YouTube from 'react-youtube';
import axios from 'axios';
import { FaPlay, FaVolumeMute, FaClosedCaptioning, FaRedo, FaUndo } from 'react-icons/fa';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const VideoCard = ({ video, isActive, onEnded, isCaptionOn, onToggleCaption, isMutedGlobal, onToggleMuteGlobal }) => {
  const [isPlaying, setIsPlaying] = useState(false); 
  const [isReady, setIsReady] = useState(false);
  const [hasCountedView, setHasCountedView] = useState(false);
  const [shouldLoadPlayer, setShouldLoadPlayer] = useState(false);
  const [isLoadingInternal, setIsLoadingInternal] = useState(true);

  const playerRef = useRef(null);
  const safetyTimeoutRef = useRef(null); 

  useEffect(() => {
    if (isActive) {
      setShouldLoadPlayer(true);
      setIsLoadingInternal(true);
    } else {
      // Khi không còn active, đợi 500ms rồi gỡ player
      const timer = setTimeout(() => {
         setShouldLoadPlayer(false);
         setIsPlaying(false);
         setIsReady(false);
         playerRef.current = null; // [FIX 1] Xóa tham chiếu player ngay lập tức để tránh gọi nhầm
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isActive]);

  // [FIX 2] Thêm cleanup khi component bị unmount đột ngột (do Swiper)
  useEffect(() => {
      return () => {
          playerRef.current = null;
      }
  }, []);

  // Sync Mute state
  useEffect(() => {
    // Chỉ gọi khi playerRef còn tồn tại và đang ready
    if (isReady && playerRef.current) {
        if (isMutedGlobal) {
            safePlayerCall('mute');
        } else {
            if (isActive) {
                safePlayerCall('unMute');
                if (playerRef.current.setVolume) {
                    try { playerRef.current.setVolume(100); } catch(e){}
                }
            }
        }
    }
  }, [isMutedGlobal, isActive, isReady]);

  const recordView = () => {
    if (!hasCountedView) {
      axios.post(`${API_BASE_URL}/api/view/${video.id}`).catch(() => {});
      setHasCountedView(true);
    }
  };

  // [FIX 3] Hàm gọi player an toàn tuyệt đối
  const safePlayerCall = (action) => {
    const player = playerRef.current;
    if (!player) return;

    try {
        // Kiểm tra xem hàm có tồn tại không TRONG try-catch để tránh crash
        if (typeof player[action] === 'function') {
            // Kiểm tra iframe còn sống không
            const iframe = player.getIframe ? player.getIframe() : null;
            if (iframe && iframe.isConnected) {
                player[action]();
            }
        }
    } catch (e) { 
        // Nuốt lỗi để không làm đen màn hình
        console.warn("YouTube Player Warning (Ignored):", e);
    }
  };

  const opts = useMemo(() => ({
    height: '100%',
    width: '100%',
    playerVars: {
      autoplay: 1,
      controls: 0,
      rel: 0,
      showinfo: 0,
      modestbranding: 1,
      disablekb: 1,
      fs: 0,
      playsinline: 1,
      cc_load_policy: isCaptionOn ? 1 : 0, 
      origin: window.location.origin,
    },
  }), [isCaptionOn]);

  const onReady = (event) => {
    // Nếu component đã bị hủy trong lúc đang load, thì thôi không làm gì cả
    if (!shouldLoadPlayer) return;

    playerRef.current = event.target;
    setIsReady(true);
    
    // Logic PWA: Check mute global
    if (isMutedGlobal) {
        safePlayerCall('mute'); 
    } else {
        safePlayerCall('unMute');
        try { event.target.setVolume(100); } catch(e){}
    }
    
    safePlayerCall('playVideo');
    startSafetyTimeout();
  };

  const startSafetyTimeout = () => {
    if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
    safetyTimeoutRef.current = setTimeout(() => {
      setIsLoadingInternal((prev) => {
        if (prev) return false; 
        return prev;
      });
    }, 4000); 
  };

  const onStateChange = (event) => {
    // Nếu playerRef đã null (đã unmount), bỏ qua mọi sự kiện
    if (!playerRef.current && !isActive) return;

    if (event.data === 1) { // Playing
      setIsPlaying(true);
      setIsLoadingInternal(false);
      if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
      
      // Double check âm thanh
      if (!isMutedGlobal) safePlayerCall('unMute');
    } 
    else if (event.data === 3) { // Buffering
      setIsLoadingInternal(true);
      startSafetyTimeout();
    } 
    else if (event.data === 2) { // Paused
      setIsPlaying(false);
      setIsLoadingInternal(false);
    } 
    else if (event.data === 0) { // Ended
      setIsPlaying(false);
      if (isActive) {
          recordView();
          if (onEnded) onEnded();
      }
    }
  };

  useEffect(() => {
    let interval = null;
    if (isActive && isPlaying && !hasCountedView) {
      interval = setInterval(() => {
        const player = playerRef.current;
        // Thêm try-catch cho getCurrentTime
        try {
            if (player && typeof player.getCurrentTime === 'function') {
                if (player.getCurrentTime() >= 15) {
                  recordView();
                  clearInterval(interval);
                }
            }
        } catch(e){}
      }, 1000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [isActive, isPlaying, hasCountedView]);

  const togglePlay = () => {
    if (isLoadingInternal) setIsLoadingInternal(false);

    if (isMutedGlobal) {
        if (onToggleMuteGlobal) onToggleMuteGlobal(false);
        safePlayerCall('unMute'); 
        if(playerRef.current) {
             try { playerRef.current.setVolume(100); } catch(e){}
        }
    } else {
      if (isPlaying) safePlayerCall('pauseVideo');
      else safePlayerCall('playVideo');
    }
  };

  const handleSeek = (e, sec) => {
    e.stopPropagation();
    const player = playerRef.current;
    if (player && typeof player.seekTo === 'function') {
        try {
            player.seekTo(player.getCurrentTime() + sec, true);
        } catch(e){}
    }
  };

  return (
    <div className="video-card" onClick={togglePlay}>
      <img 
        src={video.thumbnail} 
        alt="Thumbnail"
        style={{
            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', 
            objectFit: 'cover', zIndex: 1
        }}
      />

      {shouldLoadPlayer && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 2, background: 'black' }}>
            <YouTube
                videoId={video.id}
                opts={opts}
                onReady={onReady}
                onStateChange={onStateChange}
                // Thêm onError để bắt lỗi nội bộ nếu có
                onError={(e) => console.warn("YouTube Internal Error:", e)}
                className="video-iframe"
                iframeClassName="video-iframe"
            />
        </div>
      )}

      {/* SPINNER */}
      {shouldLoadPlayer && (!isReady || isLoadingInternal) && (
         <div style={{
             position:'absolute', top:0, left:0, width: '100%', height: '100%',
             backgroundColor: 'black', 
             display: 'flex', justifyContent: 'center', alignItems: 'center',
             zIndex: 10, pointerEvents:'none'
         }}>
             <div className="css-spinner"></div>
         </div>
      )}

      {shouldLoadPlayer && !isLoadingInternal && isReady && (
        <div style={{zIndex: 50}}>
            <button 
              onClick={(e) => { e.stopPropagation(); if(onToggleCaption) onToggleCaption(); }}
              style={{
                position: 'absolute', top: 20, left: 20,
                background: isCaptionOn ? 'rgba(254, 44, 85, 0.8)' : 'rgba(0, 0, 0, 0.4)',
                border: '1px solid rgba(255,255,255,0.3)', borderRadius: '4px',
                color: 'white', padding: '5px 8px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '5px',
                fontSize: '12px', fontWeight: 'bold'
              }}
            >
              <FaClosedCaptioning size={16} />
              {isCaptionOn ? 'ON' : 'OFF'}
            </button>

            {isActive && (
                <div style={{
                  position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                  display: 'flex', flexDirection: 'column', gap: '20px'
                }}>
                  <button onClick={(e) => handleSeek(e, -5)} className="seek-btn">
                    <FaUndo size={14} style={{marginBottom:'2px'}}/> -5s
                  </button>
                  <button onClick={(e) => handleSeek(e, 5)} className="seek-btn">
                    <FaRedo size={14} style={{marginBottom:'2px'}}/> +5s
                  </button>
                </div>
            )}

            {isMutedGlobal && isActive && (
                <div className="play-icon-overlay">
                  <FaVolumeMute size={40} color="white" style={{ opacity: 0.8 }} />
                  <p style={{color:'white', marginTop: 10, fontSize: 12}}>Bấm hoặc lướt để bật tiếng</p>
                </div>
            )}

            {!isPlaying && isActive && !isMutedGlobal && (
                <div className="play-icon-overlay">
                  <FaPlay size={50} color="white" style={{ opacity: 0.8 }} />
                </div>
            )}
        </div>
      )}

      <div className="video-info" style={{zIndex: 60}}>
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
      
      <style>{`
        .css-spinner {
            border: 4px solid rgba(255, 255, 255, 0.3);
            border-top: 4px solid #fff;
            border-radius: 50%;
            width: 40px; height: 40px;
            animation: spin 1s linear infinite;
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

        .seek-btn {
            background: rgba(0,0,0,0.4); color: white; width: 45px; height: 45px;
            border-radius: 50%; border: 1px solid rgba(255,255,255,0.2);
            display: flex; flex-direction: column; align-items: center; justifyContent: center;
            font-size: 10px; cursor: pointer; transition: background 0.2s;
        }
        .seek-btn:active { background: rgba(255,255,255,0.2); }
      `}</style>
    </div>
  );
};

export default VideoCard;