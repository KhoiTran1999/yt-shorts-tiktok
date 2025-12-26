// frontend/src/App.jsx
import React, { useState } from 'react';
import { googleLogout } from '@react-oauth/google';
import VideoFeed from './components/VideoFeed';
import LoginButton from './components/LoginButton';
import AddChannelModal from './components/AddChannelModal';
import SubsModal from './components/SubsModal';
import UserMenu from './components/UserMenu';
import './App.css';

function App() {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  
  const [refreshKey, setRefreshKey] = useState(0); 
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSubsModal, setShowSubsModal] = useState(false);

  // --- MỚI: QUẢN LÝ TRẠNG THÁI CAPTION TOÀN CỤC ---
  const [isCaptionOn, setIsCaptionOn] = useState(false); // Mặc định tắt

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user');
    googleLogout(); 
  };

  const handleChannelAdded = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleListChanged = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="app-container">
      {!user ? (
        <LoginButton onLoginSuccess={handleLoginSuccess} />
      ) : (
        <>
          <UserMenu 
            user={user}
            onLogout={handleLogout}
            onOpenAddChannel={() => setShowAddModal(true)}
            onOpenSubs={() => setShowSubsModal(true)}
          />

          <AddChannelModal 
            userId={user.id} 
            onChannelAdded={handleChannelAdded}
            isOpen={showAddModal}
            onClose={() => setShowAddModal(false)}
          />

          <SubsModal 
            userId={user.id} 
            onListChanged={handleListChanged}
            isOpen={showSubsModal}
            onClose={() => setShowSubsModal(false)}
          />
        </>
      )}

      {/* Truyền trạng thái Caption xuống VideoFeed */}
      <VideoFeed 
        key={`${user ? user.id : 'guest'}-${refreshKey}`} 
        userId={user?.id} 
        isCaptionOn={isCaptionOn} // <--- TRUYỀN XUỐNG
        onToggleCaption={() => setIsCaptionOn(prev => !prev)} // <--- HÀM ĐỔI TRẠNG THÁI
      />
    </div>
  );
}

export default App;