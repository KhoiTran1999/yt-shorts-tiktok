import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaTrash, FaTimes } from 'react-icons/fa';
const API_URL = import.meta.env.VITE_API_BASE_URL;

// THAY ĐỔI: Nhận props isOpen và onClose
const SubsModal = ({ userId, onListChanged, isOpen, onClose }) => {
  const [channels, setChannels] = useState([]);

  const loadSubs = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/subscriptions?user_id=${userId}`);
      setChannels(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  // Khi modal mở ra thì mới load dữ liệu
  useEffect(() => {
    if (isOpen && userId) {
      loadSubs();
    }
  }, [isOpen, userId]);

  const handleUnsub = async (channelId) => {
    if (!confirm("Bạn chắc chắn muốn bỏ theo dõi kênh này?")) return;
    try {
      await axios.post(`${API_URL}/api/unsubscribe`, {
        user_id: userId,
        channel_id: channelId
      });
      setChannels(channels.filter(c => c.id !== channelId));
      if (onListChanged) onListChanged();
    } catch (error) {
      alert("Lỗi kết nối server");
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
      backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 250,
      display: 'flex', justifyContent: 'center', alignItems: 'center'
    }}>
      <div style={{
        backgroundColor: '#161823', width: '90%', maxWidth: '400px',
        borderRadius: '10px', padding: '20px', color: 'white',
        maxHeight: '80vh', overflowY: 'auto', position: 'relative'
      }}>
        <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '20px'}}>
          <h3 style={{margin:0}}>Đang theo dõi ({channels.length})</h3>
          <button onClick={onClose} style={{background: 'none', border: 'none', color: 'white', fontSize: '18px', cursor: 'pointer'}}><FaTimes /></button>
        </div>

        {channels.length === 0 ? (
          <p style={{color: '#888', textAlign: 'center'}}>Chưa theo dõi kênh nào.</p>
        ) : (
          <div style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
            {channels.map(ch => (
              <div key={ch.id} style={{display: 'flex', alignItems: 'center', gap: '10px', background: '#2f3136', padding: '10px', borderRadius: '8px'}}>
                <img src={ch.avatar || 'https://via.placeholder.com/50'} style={{width: 40, height: 40, borderRadius: '50%'}} />
                <div style={{flex: 1, overflow: 'hidden'}}>
                  <div style={{fontWeight: 'bold', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden'}}>{ch.name}</div>
                  <div style={{fontSize: '12px', color: '#aaa'}}>ID: {ch.id}</div>
                </div>
                <button 
                  onClick={() => handleUnsub(ch.id)}
                  style={{background: 'none', border: 'none', color: '#ff4d4f', cursor: 'pointer'}}
                >
                  <FaTrash />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SubsModal;