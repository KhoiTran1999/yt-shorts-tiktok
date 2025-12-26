// frontend/src/components/VideoCard.jsx
import React from 'react';
import { FaPlay, FaVolumeMute, FaClosedCaptioning } from 'react-icons/fa';

const VideoCard = ({ 
    video, isActive, isGlobalPlaying, isVideoLoaded, 
    isMutedGlobal, onTogglePlay, isCaptionOn, onToggleCaption 
}) => {
  
  return (
    <div className="video-card" onClick={onTogglePlay}>
      
      {/* 1. THUMBNAIL LAYER */}
      {/* Thumbnail chỉ hiện khi video chưa load xong HOẶC slide này không active */}
      {/* Khi active và video đã load -> opacity = 0 để lộ Player bên dưới */}
      <img 
        src={video.thumbnail} 
        alt="Thumb"
        className="video-thumbnail-overlay"
        style={{ 
            opacity: (isActive && isVideoLoaded) ? 0 : 1,
            // Giữ thumbnail của slide cũ cho đến khi slide mới đè lên hoàn toàn
            zIndex: 1
        }}
      />

      {/* 2. UI LAYER (Thông tin, nút bấm) */}
      <div className="video-ui-layer">
        
        {/* Nút Caption */}
        <button 
            onClick={(e) => { e.stopPropagation(); onToggleCaption(); }}
            style={{
                position: 'absolute', top: 20, left: 20,
                background: isCaptionOn ? 'rgba(254, 44, 85, 0.8)' : 'rgba(0, 0, 0, 0.4)',
                border: '1px solid rgba(255,255,255,0.3)', borderRadius: '4px',
                color: 'white', padding: '5px 8px', fontSize: '12px', zIndex: 50
            }}
        >
            <FaClosedCaptioning /> {isCaptionOn ? 'ON' : 'OFF'}
        </button>

        {/* Icon Overlay (Mute / Play) */}
        {isActive && (
            <div className="play-icon-overlay">
                {isMutedGlobal ? (
                    <div style={{textAlign:'center'}}>
                         <FaVolumeMute size={40} color="white" style={{opacity:0.8}} />
                         <p style={{fontSize: 12, marginTop: 5}}>Bấm để bật tiếng</p>
                    </div>
                ) : (
                    !isGlobalPlaying && <FaPlay size={50} color="white" style={{opacity:0.8}} />
                )}
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
    </div>
  );
};

export default VideoCard;