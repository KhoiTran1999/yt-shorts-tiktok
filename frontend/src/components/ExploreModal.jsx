import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaTimes, FaCheck, FaPlus } from 'react-icons/fa';

const ExploreModal = ({ isOpen, onClose, userId, onListChanged }) => {
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [subbedIds, setSubbedIds] = useState([]);
  
  // State lưu kênh đang được đọc mô tả chi tiết (để hiện modal phụ)
  const [readingChannel, setReadingChannel] = useState(null);

  useEffect(() => {
    if (isOpen && userId) {
      fetchExploreChannels();
      setSubbedIds([]); 
    }
  }, [isOpen, userId]);

  const fetchExploreChannels = async () => {
    setLoading(true);
    try {
      const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
      const res = await axios.get(`${API_URL}/api/channels/explore?user_id=${userId}`);
      setChannels(res.data);
    } catch (error) {
      console.error("Lỗi tải kênh gợi ý:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSubscribe = async (channel) => {
    const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
    const isSubbed = subbedIds.includes(channel.id);

    try {
      if (isSubbed) {
        await axios.post(`${API_URL}/api/unsubscribe`, {
            user_id: userId,
            channel_id: channel.id
        });
        setSubbedIds(prev => prev.filter(id => id !== channel.id));
      } else {
        await axios.post(`${API_URL}/api/subscribe/quick`, {
            user_id: userId,
            channel_id: channel.id
        });
        setSubbedIds(prev => [...prev, channel.id]);
      }
      if (onListChanged) onListChanged();
    } catch (error) {
      alert("Có lỗi xảy ra, vui lòng thử lại!");
      console.error(error);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={overlayStyle}>
      {/* --- MODAL CHÍNH --- */}
      <div style={modalStyle}>
        <div style={headerStyle}>
          <h3>🚀 Khám phá kênh mới</h3>
          <button onClick={onClose} style={closeBtnStyle}><FaTimes /></button>
        </div>

        <div style={listStyle}>
          {loading ? (
            <p style={{ textAlign: 'center', color: '#888', marginTop: '20px' }}>Đang tìm kênh thú vị...</p>
          ) : channels.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#888', marginTop: '20px' }}>
                Bạn đã theo dõi hết các kênh hiện có rồi! 🎉
            </p>
          ) : (
            channels.map(channel => {
                const isSubbed = subbedIds.includes(channel.id);
                const desc = channel.description || '';
                const isLong = desc.length > 90; // Giới hạn 90 ký tự

                return (
                  <div key={channel.id} style={itemStyle}>
                    {/* Phần thông tin (Click để mở Youtube) */}
                    <div 
                        onClick={() => window.open(`https://www.youtube.com/channel/${channel.id}`, '_blank')}
                        style={{ 
                            display: 'flex', 
                            gap: '12px', 
                            cursor: 'pointer', 
                            flex: 1,           
                            minWidth: 0,       
                            alignItems: 'flex-start'
                        }}
                    >
                      <img 
                        src={channel.avatar} 
                        alt={channel.name} 
                        style={{...avatarStyle, marginTop: '2px'}} 
                      />
                      
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 'bold', fontSize: '15px', lineHeight: '1.2' }}>
                            {channel.name}
                          </span>
                          
                          <span style={{ 
                              fontSize: '13px', 
                              color: '#bbb', 
                              marginTop: '4px',
                              lineHeight: '1.4',
                              wordBreak: 'break-word' 
                          }}>
                            {/* Logic hiển thị rút gọn */}
                            {isLong ? desc.substring(0, 90) + '...' : (desc || 'Chưa có mô tả')}
                            
                            {/* Nút Xem thêm */}
                            {isLong && (
                                <span 
                                    onClick={(e) => {
                                        e.stopPropagation(); // Chặn sự kiện click cha (không mở Youtube)
                                        setReadingChannel(channel);
                                    }}
                                    style={{
                                        color: '#3ea6ff', 
                                        cursor: 'pointer', 
                                        marginLeft: '6px', 
                                        fontWeight: '600',
                                        fontSize: '12px'
                                    }}
                                >
                                    Xem thêm
                                </span>
                            )}
                          </span>
                      </div>
                    </div>
                    
                    {/* Phần nút Subscribe */}
                    <button 
                        onClick={() => handleToggleSubscribe(channel)}
                        style={{
                            ...(isSubbed ? unsubBtnStyle : subBtnStyle),
                            marginLeft: '10px',  
                            flexShrink: 0,       
                            whiteSpace: 'nowrap', 
                            alignSelf: 'flex-start'
                        }}
                    >
                        {isSubbed ? (
                            <><FaCheck /> Bỏ theo dõi</>
                        ) : (
                            <><FaPlus /> Theo dõi</>
                        )}
                    </button>
                  </div>
                );
            })
          )}
        </div>
      </div>

      {/* --- MODAL PHỤ: HIỂN THỊ FULL DESCRIPTION --- */}
      {readingChannel && (
          <div style={subModalOverlayStyle}>
              <div style={subModalStyle}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'15px'}}>
                    <h3 style={{margin:0, fontSize:'18px'}}>Giới thiệu: {readingChannel.name}</h3>
                    <button onClick={() => setReadingChannel(null)} style={closeBtnStyle}><FaTimes/></button>
                  </div>
                  
                  <div style={fullDescContentStyle}>
                      {readingChannel.description}
                  </div>

                  <button 
                    onClick={() => setReadingChannel(null)} 
                    style={closeSubModalBtnStyle}
                  >
                    Đóng
                  </button>
              </div>
          </div>
      )}
    </div>
  );
};

// --- STYLES ---
const overlayStyle = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1000,
  display: 'flex', alignItems: 'center', justifyContent: 'center'
};

const modalStyle = {
  backgroundColor: '#1f1f1f', color: 'white',
  width: '500px', maxHeight: '80vh', borderRadius: '12px',
  display: 'flex', flexDirection: 'column',
  boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
};

const headerStyle = {
  padding: '16px 20px', borderBottom: '1px solid #333',
  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
};

const closeBtnStyle = {
  background: 'none', border: 'none', color: '#aaa', 
  fontSize: '20px', cursor: 'pointer'
};

const listStyle = {
  padding: '10px', overflowY: 'auto', flex: 1
};

const itemStyle = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
  padding: '12px 15px', borderBottom: '1px solid #2a2a2a'
};

const avatarStyle = {
  width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0
};

const subBtnStyle = {
  backgroundColor: '#ff3b5c', color: 'white', border: 'none',
  padding: '6px 12px', borderRadius: '20px', cursor: 'pointer',
  display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', fontWeight: '600'
};

const unsubBtnStyle = {
  backgroundColor: '#3a3a3a', color: '#ccc', border: 'none',
  padding: '6px 12px', borderRadius: '20px', cursor: 'pointer',
  display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px'
};

// --- STYLES CHO SUB-MODAL ---
const subModalOverlayStyle = {
    position: 'fixed', // Đổi từ absolute sang fixed để chắc chắn full màn hình
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.85)', // Tối hơn chút để tập trung đọc
    zIndex: 9999, // Z-Index cực cao để đè tất cả
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    backdropFilter: 'blur(4px)',
    padding: '20px' // Thêm padding để không bị sát lề trên mobile
};

const subModalStyle = {
    backgroundColor: '#2b2b2b', color: 'white',
    width: '80%', maxHeight: '60%', borderRadius: '10px',
    padding: '20px', display: 'flex', flexDirection: 'column',
    boxShadow: '0 5px 15px rgba(0,0,0,0.5)'
};

const fullDescContentStyle = {
    flex: 1, overflowY: 'auto', whiteSpace: 'pre-wrap', 
    lineHeight: '1.6', color: '#ddd', fontSize: '14px',
    marginBottom: '15px', border: '1px solid #444', padding: '10px', borderRadius: '6px',
    backgroundColor: '#222'
};

const closeSubModalBtnStyle = {
    alignSelf: 'flex-end',
    backgroundColor: '#444', color: 'white', border: 'none',
    padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight:'bold'
};

export default ExploreModal;