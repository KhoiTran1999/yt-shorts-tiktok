import React, { useState, useRef, useEffect, useMemo } from 'react';
import YouTube from 'react-youtube';
import { FaPlay, FaVolumeMute, FaClosedCaptioning, FaRedo, FaUndo } from 'react-icons/fa';

const VideoCard = ({ video, isActive, onEnded, index, isCaptionOn, onToggleCaption, isMutedGlobal, onToggleMuteGlobal }) => {
  const [isPlaying, setIsPlaying] = useState(false); // Mặc định là false
  const [isReady, setIsReady] = useState(false);
  const playerRef = useRef(null);

  // --- Hàm an toàn gọi API ---
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
      // SỬA 1: Tắt autoplay của YouTube để tránh việc nó tự chạy ngầm gây chồng âm thanh
      autoplay: 0, 
      controls: 0,
      rel: 0,
      showinfo: 0,
      modestbranding: 1,
      disablekb: 1,
      fs: 0,
      playsinline: 1, // Bắt buộc cho iOS
      cc_load_policy: isCaptionOn ? 1 : 0, 
      origin: window.location.origin,
    },
  }), [isCaptionOn]);

  const onReady = (event) => {
    playerRef.current = event.target;
    setIsReady(true);
    
    // Luôn mute lúc load xong để chuẩn bị cho autoplay
    event.target.mute(); 

    // Nếu slide này đang hiện thì mới play
    if (isActive) {
      event.target.playVideo();
    }
  };

  const onStateChange = (event) => {
    if (event.data === 0 && isActive && onEnded) onEnded();
    
    // SỬA 2: CHỈ BẬT TIẾNG KHI VIDEO ĐÃ THỰC SỰ CHẠY
    // (Tránh bị iOS chặn ngay từ cửa)
    if (event.data === 1) { // 1 = Playing
      setIsPlaying(true);
      
      // Nếu Global đang bật tiếng -> Thì mới thử Unmute video này
      if (!isMutedGlobal) {
        // Delay nhẹ 200ms để iOS không tưởng nhầm là spam
        setTimeout(() => {
             safePlayerCall('unmute');
        }, 200);
      }
    }
    
    if (event.data === 2) setIsPlaying(false); // 2 = Paused
  };

  // SỬA 3: QUẢN LÝ PLAY/PAUSE NGHIÊM NGẶT THEO isActive
  useEffect(() => {
    if (!playerRef.current) return;

    if (isActive) {
      // Khi lướt tới:
      // 1. Mute trước (để qua mặt iOS)
      safePlayerCall('mute');
      // 2. Play ngay
      safePlayerCall('play');
      setIsPlaying(true);
    } else {
      // Khi lướt đi:
      // 1. Pause ngay lập tức
      safePlayerCall('pause');
      // 2. Mute luôn cho chắc ăn (tránh rò rỉ âm thanh)
      safePlayerCall('mute');
      setIsPlaying(false);
    }
  }, [isActive]); 
  // Lưu ý: Đã bỏ dependency isMutedGlobal ở đây để tránh việc toggle mute làm video bị reload/pause nhầm

  const togglePlay = () => {
    if (!playerRef.current) return;
    
    // Logic User Click:
    if (isMutedGlobal) {
      // Nếu đang tắt tiếng -> Bấm để Bật tiếng
      safePlayerCall('unmute');
      if (onToggleMuteGlobal) onToggleMuteGlobal(false); 
    } else {
      // Nếu đã có tiếng -> Bấm để Pause/Play
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