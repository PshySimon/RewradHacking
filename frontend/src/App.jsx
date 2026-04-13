import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Login from './pages/Login';
import Setup from './pages/Setup';
import Dashboard from './pages/Dashboard';
import Editor from './pages/Editor';

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('access_token');
  return token ? children : <Navigate to="/login" replace />;
};

function App() {
  const [isInitializing, setIsInitializing] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // 根节点大探针：前台独立判断是否重定向到 Setup 并锁死入口
    axios.get('/api/system/status')
      .then(res => {
        if (res.data.needs_initialization) {
          navigate('/setup');
        }
      })
      .catch(err => {
        console.warn("探测后端装填状态抛出跨域异常/无响应:", err);
      })
      .finally(() => {
        setIsInitializing(false);
      });
  }, [navigate]);

  if (isInitializing) {
     return <div style={{ height: '100vh', display:'flex', justifyContent:'center', alignItems:'center'}}>Booting Environment...</div>;
  }

    return (
      <Routes>
        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/editor" element={<ProtectedRoute><Editor /></ProtectedRoute>} />
        <Route path="/login" element={<Login />} />
        <Route path="/setup" element={<Setup />} />
      </Routes>
    );
}

export default App;
