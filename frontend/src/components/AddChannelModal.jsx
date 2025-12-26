import React, { useState } from 'react';
import axios from 'axios';
import { FaTimes, FaSpinner } from 'react-icons/fa';

// THAY ĐỔI: Nhận props isOpen và onClose từ App.jsx
const AddChannelModal = ({ userId, onChannelAdded, isOpen, onClose }) => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!url) return;

    setLoading(true);
    setMessage('Đang kết nối với máy chủ...');

    try {
      await axios.post('http://localhost:8000/api/channels', {
        url: url,
        user_id: userId
      });

      setMessage('Đang quét video từ YouTube... (Việc này mất khoảng 10-20 giây)');
      
      setTimeout(() => {
        setLoading(false);
        setUrl('');
        setMessage('');
        alert("Đã thêm kênh! Hãy tải lại trang sau vài giây để thấy video mới.");
        if (onChannelAdded) onChannelAdded();
        onClose(); // Đóng modal sau khi thành công
      }, 5000);

    } catch (error) {
      console.error(error);
      setLoading(false);
      setMessage('Lỗi: Không thể thêm kênh này.');
    }
  };

  // Nếu isOpen = false thì không render gì cả
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
      backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 200,
      display: 'flex', justifyContent: 'center', alignItems: 'center'
    }}>
      <div style={{
        backgroundColor: '#161823', padding: '20px', borderRadius: '10px',
        width: '90%', maxWidth: '400px', position: 'relative', color: 'white'
      }}>
        {/* Nút đóng gọi hàm onClose */}
        <button 
          onClick={onClose}
          style={{
            position: 'absolute', top: 10, right: 10, background: 'none', 
            border: 'none', color: 'white', fontSize: '18px', cursor: 'pointer'
          }}
        >
          <FaTimes />
        </button>

        <h3 style={{marginTop: 0}}>Thêm kênh mới</h3>
        <p style={{fontSize: '14px', color: '#ccc'}}>Dán link kênh YouTube Shorts vào đây</p>
        
        <form onSubmit={handleSubmit}>
          <input 
            type="text" 
            placeholder="VD: https://youtube.com/@abc..." 
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            style={{
              width: '100%', padding: '10px', marginBottom: '15px',
              borderRadius: '5px', border: '1px solid #333',
              backgroundColor: '#2f3136', color: 'white', boxSizing: 'border-box'
            }}
          />
          
          <button 
            type="submit" 
            disabled={loading}
            style={{
              width: '100%', padding: '10px', borderRadius: '5px',
              border: 'none', backgroundColor: '#fe2c55', color: 'white',
              fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? <span style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px'}}><FaSpinner className="icon-spin"/> Đang xử lý...</span> : 'Thêm Kênh'}
          </button>
        </form>
        
        {message && <p style={{marginTop: '10px', fontSize: '13px', color: '#00d2ff'}}>{message}</p>}
      </div>
      <style>{`
        .icon-spin { animation: spin 1s infinite linear; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default AddChannelModal;