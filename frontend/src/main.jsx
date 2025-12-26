import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { GoogleOAuthProvider } from '@react-oauth/google';

// Thay CLIENT ID của bạn vào đây
const CLIENT_ID = "237320924792-b8jugiphuech1l8mjr7ieecopc0829it.apps.googleusercontent.com";

ReactDOM.createRoot(document.getElementById('root')).render(
  <GoogleOAuthProvider clientId={CLIENT_ID}>
    <React.StrictMode>
      <App />
    </React.StrictMode>
  </GoogleOAuthProvider>,
)