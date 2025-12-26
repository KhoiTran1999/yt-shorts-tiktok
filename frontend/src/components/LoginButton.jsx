import React from 'react';
import { GoogleLogin } from '@react-oauth/google';
import axios from 'axios';
const API_URL = import.meta.env.VITE_API_BASE_URL;

const LoginButton = ({ onLoginSuccess }) => {
  
  const handleSuccess = async (credentialResponse) => {
    try {
      // Gửi token về Backend để verify và lấy info user
      const res = await axios.post(`${API_URL}/api/auth/google`, {
        token: credentialResponse.credential
      });
      
      console.log("Login User:", res.data);
      // Gọi callback để App cập nhật trạng thái
      onLoginSuccess(res.data);
      
    } catch (error) {
      console.error("Login Failed:", error);
    }
  };

  return (
    <div style={{ position: 'absolute', top: 20, right: 20, zIndex: 100 }}>
      <GoogleLogin
        onSuccess={handleSuccess}
        onError={() => {
          console.log('Login Failed');
        }}
        useOneTap
        theme="filled_black"
        shape="pill"
      />
    </div>
  );
};

export default LoginButton;