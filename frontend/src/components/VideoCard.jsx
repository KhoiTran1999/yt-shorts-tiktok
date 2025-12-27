// frontend/src/components/VideoCard.jsx
import React from 'react';
import { FaPlay, FaVolumeMute, FaClosedCaptioning, FaRedo, FaUndo } from 'react-icons/fa';

const VideoCard = ({ 
    video, isActive, isGlobalPlaying, isVideoLoaded, 
    isMutedGlobal, onTogglePlay, isCaptionOn, onToggleCaption,
    onSeek // [MỚI] Nhận prop onSeek
}) => {
  
  return (
    <div className="video-card" onClick={onTogglePlay}>
      
      {/* 1. THUMBNAIL LAYER */}
      <img 
        src={video.thumbnail} 
        alt="Thumb"
        className="video-thumbnail-overlay"
        style={{ 
            // Chỉ ẩn thumbnail khi video đã thực sự Load xong và đang Active
            opacity: (isActive && isVideoLoaded) ? 0 : 1,
            zIndex: 1,
            transition: 'opacity 0.3s ease'
        }}
      />

      {/* 2. UI LAYER */}
      <div className="video-ui-layer">
        
        {/* Nút Caption */}
        <button 
            onClick={(e) => { e.stopPropagation(); onToggleCaption(); }}
            style={{
                position: 'absolute', top: 20, left: 20,
                background: isCaptionOn ? 'rgba(254, 44, 85, 0.8)' : 'rgba(0, 0, 0, 0.4)',
                border: '1px solid rgba(255,255,255,0.3)', borderRadius: '4px',
                color: 'white', padding: '5px 8px', fontSize: '12px', zIndex: 50, cursor: 'pointer'
            }}
        >
            <FaClosedCaptioning /> {isCaptionOn ? 'ON' : 'OFF'}
        </button>

        {/* [MỚI] Nút Tua (Chỉ hiện khi Active) */}
        {isActive && (
            <div style={{
              position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
              display: 'flex', flexDirection: 'column', gap: '20px', zIndex: 60
            }}>
              <button onClick={(e) => { e.stopPropagation(); onSeek(-5); }} className="seek-btn">
                <FaUndo size={14} style={{marginBottom:'2px'}}/> -5s
              </button>
              <button onClick={(e) => { e.stopPropagation(); onSeek(5); }} className="seek-btn">
                <FaRedo size={14} style={{marginBottom:'2px'}}/> +5s
              </button>
            </div>
        )}

        {/* CENTER OVERLAY: Xử lý hiển thị thông minh */}
        {isActive && (
            <div className="play-icon-overlay" style={{pointerEvents: 'none'}}> 
                {/* pointerEvents: none để click xuyên qua overlay vào div cha */}
                
                {!isVideoLoaded ? (
                    /* CASE 1: ĐANG LOADING -> HIỆN SPINNER */
                    <div className="css-spinner"></div>
                ) : isMutedGlobal ? (
                    /* CASE 2: ĐANG MUTE -> HIỆN ICON LOA */
                    <div style={{textAlign:'center'}}>
                         <FaVolumeMute size={40} color="white" style={{opacity:0.8}} />
                         <p style={{fontSize: 12, marginTop: 5, textShadow: '0 0 4px black', color: 'white'}}>Bấm để bật tiếng</p>
                    </div>
                ) : !isGlobalPlaying ? (
                    /* CASE 3: ĐANG PAUSE -> HIỆN NÚT PLAY */
                    <FaPlay size={50} color="white" style={{opacity:0.8}} />
                ) : null}
                
            </div>
        )}

        {/* Thông tin Video */}
        <div className="video-info">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <img 
                    src={video.channel_avatar} 
                    style={{ width: 40, height: 40, borderRadius: '50%', border: '1px solid white' }} 
                />
                <h4 style={{ margin: 0, textShadow: '1px 1px 2px black' }}>{video.channel_name}</h4>
            </div>
            <p className="video-title" style={{ margin: 0, textShadow: '1px 1px 2px black' }}>
                {video.title}
            </p>
        </div>

      </div>

      {/* CSS Nhúng (Phục hồi CSS cũ) */}
      <style>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

        .seek-btn {
            background: rgba(0,0,0,0.4); color: white; width: 45px; height: 45px;
            border-radius: 50%; border: 1px solid rgba(255,255,255,0.2);
            display: flex; flex-direction: column; align-items: center; justifyContent: center;
            font-size: 10px; cursor: pointer; transition: background 0.2s; 
            pointer-events: auto; /* Quan trọng: để click được */
        }
        .seek-btn:active { background: rgba(255,255,255,0.2); }
      `}</style>
    </div>
  );
};

export default VideoCard;