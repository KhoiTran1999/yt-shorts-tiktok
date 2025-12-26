import React, { useState } from 'react';
import { googleLogout } from '@react-oauth/google';
import VideoFeed from './components/VideoFeed';
import LoginButton from './components/LoginButton';
import AddChannelModal from './components/AddChannelModal';
import SubsModal from './components/SubsModal';
import UserMenu from './components/UserMenu'; // Import component mới
import './App.css';

function App() {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  
  const [refreshKey, setRefreshKey] = useState(0); 

  // --- STATE QUẢN LÝ MODAL ---
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSubsModal, setShowSubsModal] = useState(false);

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
          {/* Thay thế cụm nút cũ bằng UserMenu */}
          <UserMenu 
            user={user}
            onLogout={handleLogout}
            onOpenAddChannel={() => setShowAddModal(true)}
            onOpenSubs={() => setShowSubsModal(true)}
          />

          {/* Render Modal với props điều khiển */}
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

      <VideoFeed 
        key={`${user ? user.id : 'guest'}-${refreshKey}`} 
        userId={user?.id} 
      />
    </div>
  );
}

export default App;