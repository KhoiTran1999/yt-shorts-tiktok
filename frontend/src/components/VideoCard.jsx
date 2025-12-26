import React, { useState, useRef, useEffect, useMemo } from 'react';
import YouTube from 'react-youtube';
import axios from 'axios'; // [MỚI] Import axios để gọi API
import { FaPlay, FaVolumeMute, FaClosedCaptioning, FaRedo, FaUndo } from 'react-icons/fa';

// [MỚI] Lấy URL Backend
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const VideoCard = ({ video, isActive, onEnded, index, isCaptionOn, onToggleCaption, isMutedGlobal, onToggleMuteGlobal }) => {
  const [isPlaying, setIsPlaying] = useState(false); 
  const [isReady, setIsReady] = useState(false);
  const playerRef = useRef(null);

  // [MỚI] State để khóa: Đã tính view chưa?
  const [hasCountedView, setHasCountedView] = useState(false);

  // --- [MỚI] HÀM GỌI API CỘNG ĐIỂM ---
  const recordView = () => {
    if (!hasCountedView) {
      console.log(`👁️ Đã xem ${video.title} (>=15s hoặc hết) -> +1 Point`);
      
      // Gọi API báo cho backend
      axios.post(`${API_BASE_URL}/api/view/${video.id}`)
        .catch(err => console.error("Lỗi cộng điểm:", err));
      
      setHasCountedView(true); // Khóa lại ngay lập tức để không cộng trùng
    }
  };

  // --- Hàm an toàn gọi API Player ---
  const safePlayerCall = (action) => {
    const player = playerRef.current;
    if (!player) return;
    try {
      const iframe = player.getIframe();
      if (iframe && iframe.isConnected) {
        if (action === 'play') player.playVideo();
        if (action === 'pause') player.pauseVideo();
        if (action === 'mute') player.mute();
        if (action === 'unmute') player.unMute();
      }
    } catch (error) { console.warn("Player Error:", error); }
  };

  const handleSeek = (e, seconds) => {
    e.stopPropagation(); 
    const player = playerRef.current;
    if (!player) return;
    try {
      const iframe = player.getIframe();
      if (iframe && iframe.isConnected) {
        const currentTime = player.getCurrentTime();
        player.seekTo(currentTime + seconds, true);
      }
    } catch (error) { console.warn("Seek error:", error); }
  };

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
      playsinline: 1,
      cc_load_policy: isCaptionOn ? 1 : 0, 
      origin: window.location.origin,
    },
  }), [isCaptionOn]);

  const onReady = (event) => {
    playerRef.current = event.target;
    setIsReady(true);
    event.target.mute(); 

    if (isActive) {
      event.target.playVideo();
    }
  };

  const onStateChange = (event) => {
    // [SỬA] Xử lý khi video kết thúc (state = 0)
    if (event.data === 0 && isActive) {
      recordView(); // Nếu video ngắn < 15s mà xem hết thì vẫn tính 1 view
      if (onEnded) onEnded();
    }
    
    // Xử lý Playing (state = 1)
    if (event.data === 1) { 
      setIsPlaying(true);
      if (!isMutedGlobal) {
        setTimeout(() => {
             safePlayerCall('unmute');
        }, 200);
      }
    }
    
    // Xử lý Paused (state = 2)
    if (event.data === 2) setIsPlaying(false);
  };

  // --- [MỚI] LOGIC CHECK 15 GIÂY ---
  useEffect(() => {
    let interval = null;

    // Chỉ chạy timer khi: Đang active, Đang play, và CHƯA tính view
    if (isActive && isPlaying && !hasCountedView) {
      interval = setInterval(() => {
        const player = playerRef.current;
        if (player && typeof player.getCurrentTime === 'function') {
          try {
            const currentTime = player.getCurrentTime();
            // NẾU XEM QUÁ 15 GIÂY
            if (currentTime >= 15) {
              recordView();
              clearInterval(interval); // Xong nhiệm vụ thì dừng
            }
          } catch (e) { /* Bỏ qua lỗi nhỏ khi player chưa sẵn sàng */ }
        }
      }, 1000); // Check mỗi 1 giây
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive, isPlaying, hasCountedView]); 


  // QUẢN LÝ PLAY/PAUSE THEO isActive
  useEffect(() => {
    if (!playerRef.current) return;

    if (isActive) {
      safePlayerCall('mute');
      safePlayerCall('play');
      setIsPlaying(true);
    } else {
      safePlayerCall('pause');
      safePlayerCall('mute');
      setIsPlaying(false);
      // Có thể reset hasCountedView ở đây nếu muốn mỗi lần lướt lại tính view mới
      // setHasCountedView(false); 
    }
  }, [isActive]); 

  const togglePlay = () => {
    if (!playerRef.current) return;
    
    if (isMutedGlobal) {
      safePlayerCall('unmute');
      if (onToggleMuteGlobal) onToggleMuteGlobal(false); 
    } else {
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
        loading="lazy"
      />

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

      {/* Nút Tua */}
      {isReady && (
        <div style={{
          position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
          display: 'flex', flexDirection: 'column', gap: '20px', zIndex: 60 
        }}>
          <button onClick={(e) => handleSeek(e, -5)} style={{background:'rgba(0,0,0,0.4)', color:'white', width:'45px', height:'45px', borderRadius:'50%', border:'1px solid rgba(255,255,255,0.2)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', fontSize: '10px'}}>
            <FaUndo size={14} style={{marginBottom:'2px'}}/> -5s
          </button>
          <button onClick={(e) => handleSeek(e, 5)} style={{background:'rgba(0,0,0,0.4)', color:'white', width:'45px', height:'45px', borderRadius:'50%', border:'1px solid rgba(255,255,255,0.2)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', fontSize: '10px'}}>
            <FaRedo size={14} style={{marginBottom:'2px'}}/> +5s
          </button>
        </div>
      )}

      {/* ICON LOA TẮT */}
      {isMutedGlobal && isActive && (
        <div className="play-icon-overlay">
          <FaVolumeMute size={40} color="white" style={{ opacity: 0.8 }} />
          <p style={{color:'white', marginTop: 10, fontSize: 12}}>Tap to unmute</p>
        </div>
      )}

      {/* ICON PLAY (Khi Pause) */}
      {isReady && !isPlaying && isActive && !isMutedGlobal && (
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