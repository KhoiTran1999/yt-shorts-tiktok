import React, { useState } from 'react';
import { FaPlus, FaList, FaSignOutAlt, FaCompass } from 'react-icons/fa';

const UserMenu = ({ user, onLogout, onOpenAddChannel, onOpenSubs, onOpenExplore }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div style={{ position: 'absolute', top: 20, right: 20, zIndex: 150 }}>
      {/* Avatar Button */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        style={{ cursor: 'pointer', position: 'relative' }}
      >
        <img 
          src={user.avatar} 
          alt="Avatar" 
          style={{ 
            width: 45, height: 45, borderRadius: '50%', 
            border: '2px solid white', objectFit: 'cover' 
          }}
        />
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div style={{
          position: 'absolute', top: '55px', right: 0,
          backgroundColor: '#252632', borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          width: '180px', overflow: 'hidden',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            <MenuItem 
              icon={<FaPlus />} label="Thêm kênh" 
              onClick={() => { setIsOpen(false); onOpenAddChannel(); }} 
            />
            <MenuItem 
              icon={<FaList />} label="Danh sách kênh" 
              onClick={() => { setIsOpen(false); onOpenSubs(); }} 
            />
            <MenuItem 
              icon={<FaCompass />} label="Khám phá kênh" 
              onClick={() => { setIsOpen(false); onOpenExplore(); }} 
            />
            <div style={{ height: '1px', background: '#3e3f4b', margin: '5px 0' }}></div>
            <MenuItem 
              icon={<FaSignOutAlt />} label="Đăng xuất" 
              onClick={() => { setIsOpen(false); onLogout(); }} 
              danger={true}
            />
          </ul>
        </div>
      )}
      
      {/* CSS Animation nhỏ trong component này */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};

// Component con để render từng dòng cho gọn
const MenuItem = ({ icon, label, onClick, danger }) => (
  <li 
    onClick={onClick}
    style={{
      padding: '12px 15px', display: 'flex', alignItems: 'center', gap: '10px',
      cursor: 'pointer', color: danger ? '#ff4d4f' : 'white',
      fontSize: '14px', transition: 'background 0.2s'
    }}
    onMouseEnter={(e) => e.currentTarget.style.background = '#3e3f4b'}
    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
  >
    {icon} <span>{label}</span>
  </li>
);

export default UserMenu;