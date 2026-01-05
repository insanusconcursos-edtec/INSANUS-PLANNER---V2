import React, { useState, useEffect } from 'react';
import { Icon } from './components/Icons';
import { LoginScreen } from './screens/LoginScreen';
import { AdminDashboard } from './screens/AdminDashboard';
import { UserDashboard } from './screens/UserDashboard';
import { User } from './types';
import { ADMIN_EMAIL, ADMIN_PASS } from './constants';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<'login' | 'admin' | 'user'>('login');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Check for existing session (simulated)
  useEffect(() => {
    const savedUser = localStorage.getItem('insanus_user');
    if (savedUser) {
      const parsedUser = JSON.parse(savedUser);
      setUser(parsedUser);
      setView(parsedUser.isAdmin ? 'admin' : 'user');
    }
  }, []);

  const handleLogin = (userData: User) => {
    localStorage.setItem('insanus_user', JSON.stringify(userData));
    setUser(userData);
    setView(userData.isAdmin ? 'admin' : 'user');
  };

  const handleLogout = () => {
    localStorage.removeItem('insanus_user');
    setUser(null);
    setView('login');
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true));
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => setIsFullscreen(false));
      }
    }
  };

  return (
    <div className="h-full w-full bg-[#050505] text-gray-100 font-sans flex flex-col overflow-hidden relative selection:bg-insanus-red selection:text-white">
      {/* Background Ambience - ONLY ON LOGIN SCREEN */}
      {view === 'login' && (
        <>
          <div className="absolute inset-0 bg-tech-grid pointer-events-none z-0" />
          <div className="absolute top-0 left-1/4 w-1/2 h-1/2 bg-insanus-red/5 rounded-full blur-[120px] pointer-events-none z-0" />
        </>
      )}

      {/* Top Bar (Solid for App, Hidden for Login) */}
      {view !== 'login' && (
        <div className="bg-[#0F0F0F] z-50 border-b border-[#333] h-14 shrink-0 flex justify-between items-center px-6 shadow-sm w-full">
          <div className="flex items-center gap-4">
             {/* Logo */}
             <div className="flex items-center gap-2">
                <div className="w-2 h-8 bg-insanus-red shadow-neon rounded-full"></div>
                <div className="text-2xl font-black tracking-tighter text-white">
                  INSANUS <span className="text-insanus-red">PLANNER</span>
                </div>
             </div>
          </div>
          <div className="flex gap-4 items-center">
             <button onClick={toggleFullscreen} className="text-xs font-mono uppercase tracking-widest flex items-center gap-2 text-gray-400 hover:text-insanus-red transition group">
                <Icon.Maximize className="w-4 h-4 group-hover:drop-shadow-[0_0_5px_rgba(255,31,31,0.8)]" /> 
                <span className="hidden sm:inline">Tela Cheia</span>
             </button>
             <div className="h-4 w-px bg-[#333]"></div>
             <button onClick={handleLogout} className="text-xs font-mono uppercase tracking-widest flex items-center gap-2 text-gray-400 hover:text-white transition">
                <Icon.LogOut className="w-4 h-4" /> Sair
             </button>
          </div>
        </div>
      )}

      {/* Main Content Area - FORCED FULL WIDTH */}
      <div className="flex-1 flex overflow-hidden z-10 relative bg-[#050505] w-full max-w-none">
        {view === 'login' && <LoginScreen onLogin={handleLogin} />}
        
        {view === 'admin' && user?.isAdmin && (
            <div className="w-full h-full flex">
                <AdminDashboard 
                    user={user} 
                    onSwitchToUser={() => setView('user')} 
                />
            </div>
        )}
        
        {view === 'user' && user && (
            <div className="w-full h-full flex">
                <UserDashboard 
                    user={user} 
                    onUpdateUser={(u) => {
                        setUser(u);
                        localStorage.setItem('insanus_user', JSON.stringify(u));
                    }} 
                    onReturnToAdmin={user.isAdmin ? () => setView('admin') : undefined}
                />
            </div>
        )}
      </div>
    </div>
  );
}

export default App;
