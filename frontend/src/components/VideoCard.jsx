import React, { useState, useRef, useEffect, useMemo } from 'react';
import YouTube from 'react-youtube';
import axios from 'axios';
import { FaPlay, FaVolumeMute, FaClosedCaptioning, FaRedo, FaUndo, FaSpinner } from 'react-icons/fa';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const VideoCard = ({ video, isActive, onEnded, isCaptionOn, onToggleCaption, isMutedGlobal, onToggleMuteGlobal }) => {
  const [isPlaying, setIsPlaying] = useState(false); 
  const [isReady, setIsReady] = useState(false);
  const [hasCountedView, setHasCountedView] = useState(false);
  
  // State quyết định có load iframe hay không (Facade Pattern)
  const [shouldLoadPlayer, setShouldLoadPlayer] = useState(false);

  // Loading nội bộ để hiển thị spinner khi đang buffer
  const [isLoadingInternal, setIsLoadingInternal] = useState(true);

  const playerRef = useRef(null);
  const safetyTimeoutRef = useRef(null); 

  // --- LOGIC FACADE (QUAN TRỌNG NHẤT) ---
  useEffect(() => {
    if (isActive) {
      // Nếu lướt tới -> Cho phép load Player
      setShouldLoadPlayer(true);
      setIsLoadingInternal(true); // Bắt đầu load thì hiện quay quay
    } else {
      // Nếu lướt đi -> Hủy Player ngay để giải phóng RAM (Chỉ giữ lại ảnh)
      // Delay nhẹ 500ms để hiệu ứng lướt đi mượt mà, không bị chớp đen
      const timer = setTimeout(() => {
         setShouldLoadPlayer(false);
         setIsPlaying(false);
         setIsReady(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isActive]);

  const recordView = () => {
    if (!hasCountedView) {
      axios.post(`${API_BASE_URL}/api/view/${video.id}`).catch(() => {});
      setHasCountedView(true);
    }
  };

  const safePlayerCall = (action) => {
    const player = playerRef.current;
    if (!player || typeof player[action] !== 'function') return;
    try {
        const iframe = player.getIframe();
        if (iframe && iframe.isConnected) player[action]();
    } catch (e) { }
  };

  const syncVolumeState = () => {
    const player = playerRef.current;
    if (!player) return;
    if (isMutedGlobal) {
      safePlayerCall('mute');
    } else {
      safePlayerCall('unMute');
      if (player.setVolume) player.setVolume(100); 
    }
  };

  const opts = useMemo(() => ({
    height: '100%',
    width: '100%',
    playerVars: {
      autoplay: 1, // Để autoplay = 1 vì chúng ta mount component khi active
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
    playerRef.current = event.target;
    setIsReady(true);
    
    if (isMutedGlobal) event.target.mute();
    else {
      event.target.unMute();
      event.target.setVolume(100);
    }
    
    // Safety: Đảm bảo play
    event.target.playVideo();
    startSafetyTimeout();
  };

  const startSafetyTimeout = () => {
    if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
    safetyTimeoutRef.current = setTimeout(() => {
      // Sau 4s mà vẫn chưa chạy -> Tắt loading để user bấm tay
      setIsLoadingInternal((prev) => {
        if (prev) return false; 
        return prev;
      });
    }, 4000); 
  };

  const onStateChange = (event) => {
    // 1: Playing
    if (event.data === 1) { 
      setIsPlaying(true);
      setIsLoadingInternal(false);
      if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
      syncVolumeState();
    } 
    // 3: Buffering
    else if (event.data === 3) { 
      setIsLoadingInternal(true);
      startSafetyTimeout();
    } 
    // 2: Paused
    else if (event.data === 2) { 
      setIsPlaying(false);
      setIsLoadingInternal(false);
    } 
    // 0: Ended
    else if (event.data === 0) { 
      setIsPlaying(false);
      if (isActive) {
          recordView();
          if (onEnded) onEnded();
      }
    }
  };

  // Logic đếm 15s
  useEffect(() => {
    let interval = null;
    if (isActive && isPlaying && !hasCountedView) {
      interval = setInterval(() => {
        const player = playerRef.current;
        if (player && typeof player.getCurrentTime === 'function') {
          try {
            if (player.getCurrentTime() >= 15) {
              recordView();
              clearInterval(interval);
            }
          } catch(e){}
        }
      }, 1000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [isActive, isPlaying, hasCountedView]);

  const togglePlay = () => {
    if (isLoadingInternal) setIsLoadingInternal(false); // Force tắt loading nếu user bấm

    if (isMutedGlobal) {
        if (onToggleMuteGlobal) onToggleMuteGlobal(false);
        setTimeout(() => {
            safePlayerCall('unMute'); 
            if(playerRef.current) playerRef.current.setVolume(100);
        }, 100);
    } else {
      if (isPlaying) safePlayerCall('pauseVideo');
      else safePlayerCall('playVideo');
    }
  };

  const handleSeek = (e, sec) => {
    e.stopPropagation();
    const player = playerRef.current;
    if (player && player.seekTo) {
        player.seekTo(player.getCurrentTime() + sec, true);
    }
  };

  return (
    <div className="video-card" onClick={togglePlay}>
      
      {/* 1. LAYER ẢNH THUMBNAIL (Luôn hiện làm nền) */}
      <img 
        src={video.thumbnail} 
        alt="Thumbnail"
        style={{
            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', 
            objectFit: 'cover', zIndex: 1
        }}
      />

      {/* 2. LAYER YOUTUBE PLAYER (Chỉ load khi shouldLoadPlayer = true) */}
      {shouldLoadPlayer && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 2, background: 'black' }}>
            <YouTube
                videoId={video.id}
                opts={opts}
                onReady={onReady}
                onStateChange={onStateChange}
                className="video-iframe"
                iframeClassName="video-iframe"
            />
        </div>
      )}

      {/* 3. LAYER LOADING (Đè lên Player) */}
      {shouldLoadPlayer && (!isReady || isLoadingInternal) && (
         <div style={{
             position:'absolute', top:0, left:0, width: '100%', height: '100%',
             backgroundColor: 'black', 
             display: 'flex', justifyContent: 'center', alignItems: 'center',
             zIndex: 10, pointerEvents:'none'
         }}>
             <FaSpinner className="icon-spin" size={40} color="rgba(255,255,255,0.8)" />
         </div>
      )}

      {/* 4. CONTROLS (Chỉ hiện khi đã load xong và đang active) */}
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
                  <p style={{color:'white', marginTop: 10, fontSize: 12}}>Bấm để bật tiếng</p>
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
        .icon-spin { animation: spin 1s infinite linear; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
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