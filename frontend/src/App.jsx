import React, { useState } from 'react';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken('');
  };

  if (!token) {
    return <Auth onLoginSuccess={(newToken) => setToken(newToken)} />;
  }

  return <Dashboard token={token} onLogout={handleLogout} />;
}

export default App;
