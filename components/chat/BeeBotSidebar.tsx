'use client';

import { useState, useEffect, useRef } from 'react';
import { Conversation, AuthUser } from '@/types';
import BeeBotUserMenu from './BeeBotUserMenu';

interface BeeBotSidebarProps {
  conversations: Conversation[];
  currentConversationId: string;
  onSelectConversation: (id: string) => void;
  user: AuthUser | null;
}

export default function BeeBotSidebar({
  conversations,
  currentConversationId,
  onSelectConversation,
  user,
}: BeeBotSidebarProps) {
  const [activeNav, setActiveNav] = useState('home');
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Get most recent 10 conversations, sorted by updatedAt
  const recentConversations = [...conversations]
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, 10);

  // Keyboard shortcut for search (⌘K or Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
      if (e.key === 'Escape' && isSearchOpen) {
        setIsSearchOpen(false);
        setSearchQuery('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen]);

  // Static sphere component (no animation)
  const StaticSphere = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const radius = 12;

      // Create radial gradient
      const gradient = ctx.createRadialGradient(
        centerX,
        centerY,
        0,
        centerX,
        centerY,
        radius
      );

      // Orange gradient (static)
      gradient.addColorStop(0, 'rgba(255, 140, 0, 1)');
      gradient.addColorStop(0.3, 'rgba(255, 100, 80, 0.9)');
      gradient.addColorStop(0.5, 'rgba(255, 120, 150, 0.6)');
      gradient.addColorStop(0.7, 'rgba(255, 180, 200, 0.3)');
      gradient.addColorStop(1, 'rgba(255, 200, 200, 0)');

      // Draw the sphere
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fill();
    }, []);

    return <canvas ref={canvasRef} width={28} height={28} className="rounded-full" />;
  };

  return (
    <div className={`${isCollapsed ? 'w-16' : 'w-60'} h-screen bg-[#FAFAFA] flex flex-col border-r border-gray-200 transition-all duration-300`}>
      {/* Header */}
      <div className="p-4">
        {/* Logo and Collapse Button */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md flex items-center justify-center overflow-hidden">
              <StaticSphere />
            </div>
            {!isCollapsed && <span className="text-base font-bold text-gray-900">DANI</span>}
          </div>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center justify-center p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <svg className={`w-4 h-4 text-gray-400 transition-transform ${isCollapsed ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {/* Search */}
        {!isCollapsed && (
          <div className="relative mb-4">
            <button
              onClick={() => setIsSearchOpen(true)}
              className="w-full relative text-left"
            >
              <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <div className="w-full pl-9 pr-12 py-2 text-sm bg-white border border-gray-200 rounded-lg text-gray-400">
                Search
              </div>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <kbd className="text-xs text-gray-400 font-mono">⌘K</kbd>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="px-2 mb-2">
        <button
          onClick={() => setActiveNav('home')}
          className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-3 py-2 rounded-lg text-sm transition-colors ${
            activeNav === 'home' ? 'bg-gray-200 text-gray-700' : 'text-gray-500 hover:bg-gray-100'
          }`}
          title={isCollapsed ? 'Home' : undefined}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          {!isCollapsed && <span>Home</span>}
        </button>
        <button
          onClick={() => setActiveNav('library')}
          className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100 transition-colors`}
          title={isCollapsed ? 'Library' : undefined}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          {!isCollapsed && <span>Library</span>}
        </button>
        <button
          onClick={() => setActiveNav('history')}
          className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100 transition-colors`}
          title={isCollapsed ? 'History' : undefined}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {!isCollapsed && <span>History</span>}
        </button>
      </div>

      {/* Conversations */}
      {!isCollapsed && (
        <div className="flex-1 overflow-y-auto px-2">
          {recentConversations.length > 0 && (
            <div className="mb-4">
              <div className="px-3 py-1 text-xs font-medium text-gray-400 uppercase">Recent Queries</div>
              <div className="space-y-0.5">
                {recentConversations.map(conv => (
                  <button
                    key={conv.id}
                    onClick={() => onSelectConversation(conv.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition-colors ${
                      currentConversationId === conv.id ? 'bg-gray-200' : ''
                    }`}
                  >
                    <div className="truncate">{conv.title}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* User Profile */}
      <div className="p-3 border-t border-gray-200 relative">
        <div
          onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
          className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-2'} px-2 py-2 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors`}
        >
          {/* Google Icon Avatar */}
          <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          </div>
          {!isCollapsed && (
            <>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-700 truncate">
                  {user?.name || 'User'}
                </div>
                <div className="text-xs text-gray-400 truncate">
                  {user?.email || ''}
                </div>
              </div>
              <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </>
          )}
        </div>
        
        {/* User Menu Popup */}
        {isUserMenuOpen && (
          <BeeBotUserMenu user={user} onClose={() => setIsUserMenuOpen(false)} />
        )}
      </div>

      {/* Search Modal */}
      {isSearchOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/40 backdrop-blur-sm animate-fade-in" 
          onClick={() => {
            setIsSearchOpen(false);
            setSearchQuery('');
          }}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-xl mx-4 overflow-hidden animate-scale-in" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 p-4 border-b border-gray-200">
              <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search conversations..."
                autoFocus
                className="flex-1 bg-transparent border-none focus:outline-none text-gray-900 placeholder:text-gray-400 text-lg"
              />
              <button
                onClick={() => {
                  setIsSearchOpen(false);
                  setSearchQuery('');
                }}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {conversations
                .filter((conv) =>
                  conv.title.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map((conversation) => (
                  <button
                    key={conversation.id}
                    onClick={() => {
                      onSelectConversation(conversation.id);
                      setIsSearchOpen(false);
                      setSearchQuery('');
                    }}
                    className="w-full text-left p-3 rounded-xl hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {conversation.title}
                        </p>
                        <p className="text-xs text-gray-400">
                          {new Date(conversation.updatedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              {searchQuery && conversations.filter((conv) =>
                conv.title.toLowerCase().includes(searchQuery.toLowerCase())
              ).length === 0 && (
                <p className="text-center text-gray-400 py-8">
                  No conversations found
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
