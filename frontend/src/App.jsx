// frontend/src/App.jsx
import React, { useState } from 'react';
import { googleLogout } from '@react-oauth/google';
import VideoFeed from './components/VideoFeed';
import LoginButton from './components/LoginButton';
import AddChannelModal from './components/AddChannelModal';
import SubsModal from './components/SubsModal';
import UserMenu from './components/UserMenu';
import ExploreModal from './components/ExploreModal';
import './App.css';

function App() {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  
  const [refreshKey, setRefreshKey] = useState(0); 
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSubsModal, setShowSubsModal] = useState(false);
  const [showExploreModal, setShowExploreModal] = useState(false);

  // --- TRẠNG THÁI TOÀN CỤC ---
  const [isCaptionOn, setIsCaptionOn] = useState(true);
  const [isMutedGlobal, setIsMutedGlobal] = useState(true); // <--- MỚI: Mặc định tắt tiếng

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user');
    googleLogout(); 
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
            onOpenExplore={() => setShowExploreModal(true)}
          />
          <AddChannelModal 
            userId={user.id} 
            onChannelAdded={() => setRefreshKey(prev => prev + 1)}
            isOpen={showAddModal}
            onClose={() => setShowAddModal(false)}
          />
          <SubsModal 
            userId={user.id} 
            onListChanged={() => setRefreshKey(prev => prev + 1)}
            isOpen={showSubsModal}
            onClose={() => setShowSubsModal(false)}
          />
          <ExploreModal 
              userId={user.id}
              isOpen={showExploreModal}
              onClose={() => setShowExploreModal(false)}
              onListChanged={() => setRefreshKey(prev => prev + 1)}
          />
        </>
      )}

      <VideoFeed 
        key={`${user ? user.id : 'guest'}-${refreshKey}`} 
        userId={user?.id} 
        
        // --- TRUYỀN XUỐNG FEED ---
        isCaptionOn={isCaptionOn}
        onToggleCaption={() => setIsCaptionOn(prev => !prev)}
        
        isMutedGlobal={isMutedGlobal} // <--- TRUYỀN STATE
        onToggleMuteGlobal={(val) => setIsMutedGlobal(val)} // <--- TRUYỀN HÀM SET
      />
    </div>
  );
}

export default App;