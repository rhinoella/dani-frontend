'use client';

import { useState, useEffect } from 'react';
import Avatar from '@/components/ui/Avatar';
import { CloseIcon, ChevronDownIcon } from '@/components/ui/Icons';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeProvider';
import UserManagementModal from './UserManagementModal';

// Icons for the menu
const SettingsIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const LogoutIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
);

const HelpIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const EditIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

const CameraIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const UsersIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

export interface User {
  name: string;
  email?: string;
  avatar?: string;
}

interface UserMenuProps {
  user: User;
  onEditProfile?: (user: User) => void;
  onLogout?: () => void;
  onHelp?: () => void;
  isCollapsed?: boolean;
}

export default function UserMenu({
  user,
  onEditProfile,
  onLogout,
  onHelp,
  isCollapsed = false,
}: UserMenuProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isUserManagementOpen, setIsUserManagementOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    name: user.name,
    email: user.email || '',
  });
  const { updateUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const [isAppearanceOpen, setIsAppearanceOpen] = useState(false);

  const appearanceOptions = [
    { value: 'system' as const, label: 'System' },
    { value: 'light' as const, label: 'Light' },
    { value: 'dark' as const, label: 'Dark' },
  ];

  const currentAppearanceLabel = appearanceOptions.find(opt => opt.value === theme)?.label || 'System';

  // Sync form with user prop changes
  useEffect(() => {
    setEditForm({
      name: user.name,
      email: user.email || '',
    });
  }, [user.name, user.email]);

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      const success = await updateUser({ name: editForm.name });
      if (success) {
        if (onEditProfile) {
          onEditProfile({ ...user, name: editForm.name });
        }
        setIsEditProfileOpen(false);
      } else {
        console.error('Failed to update profile');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const menuItems = [
    {
      icon: <UsersIcon className="w-5 h-5" />,
      label: 'Manage users',
      onClick: () => {
        setIsMenuOpen(false);
        setIsUserManagementOpen(true);
      },
    },
    {
      icon: <EditIcon className="w-5 h-5" />,
      label: 'Edit profile',
      onClick: () => {
        setIsMenuOpen(false);
        setIsEditProfileOpen(true);
      },
    },
    {
      icon: <HelpIcon className="w-5 h-5" />,
      label: 'Help',
      onClick: () => {
        setIsMenuOpen(false);
        onHelp?.();
      },
    },
    {
      icon: <LogoutIcon className="w-5 h-5" />,
      label: 'Log out',
      onClick: () => {
        setIsMenuOpen(false);
        onLogout?.();
      },
      danger: true,
    },
  ];

  return (
    <>
      {/* User Button */}
      <div className="relative">
        {isCollapsed ? (
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="flex justify-center w-full p-2 rounded-xl hover:bg-[var(--surface-hover)] transition-all duration-200"
          >
            <Avatar
              src={user.avatar}
              alt={user.name}
              fallback={user.name}
              size="sm"
            />
          </button>
        ) : (
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="flex items-center gap-3 w-full p-2 rounded-xl hover:bg-[var(--surface-hover)] transition-all duration-200"
          >
            <Avatar
              src={user.avatar}
              alt={user.name}
              fallback={user.name}
              size="sm"
            />
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-medium text-[var(--foreground)] truncate">
                {user.name}
              </p>
            </div>
          </button>
        )}

        {/* Dropdown Menu */}
        {isMenuOpen && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 z-40"
              onClick={() => setIsMenuOpen(false)}
            />
            
            {/* Menu */}
            <div className={`
              absolute z-50 
              ${isCollapsed ? 'left-full ml-2 bottom-0' : 'bottom-full mb-2 left-0 right-0'}
              min-w-[200px]
              glass-strong rounded-xl shadow-lg
              border border-[var(--border)]
              overflow-hidden
              animate-scale-in
            `}>
              {/* User Info Header */}
              <div className="p-3 border-b border-[var(--border)]">
                <div className="flex items-center gap-3">
                  <Avatar
                    src={user.avatar}
                    alt={user.name}
                    fallback={user.name}
                    size="md"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--foreground)] truncate">
                      {user.name}
                    </p>
                    {user.email && (
                      <p className="text-xs text-[var(--foreground-muted)] truncate">
                        {user.email}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Menu Items */}
              <div className="p-1">
                {menuItems.map((item, index) => (
                  <button
                    key={index}
                    onClick={item.onClick}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                      transition-all duration-200
                      ${item.danger 
                        ? 'text-red-500 hover:bg-red-500/10' 
                        : 'text-[var(--foreground)] hover:bg-[var(--surface-hover)]'
                      }
                    `}
                  >
                    {item.icon}
                    <span className="text-sm">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Edit Profile Modal */}
      {isEditProfileOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={() => setIsEditProfileOpen(false)}
        >
          <div 
            className="w-full max-w-md glass-strong rounded-2xl shadow-2xl animate-scale-in overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
              <h2 className="text-lg font-semibold text-[var(--foreground)]">
                Edit profile
              </h2>
              <button
                onClick={() => setIsEditProfileOpen(false)}
                className="p-1 rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
              >
                <CloseIcon className="w-5 h-5 text-[var(--foreground-muted)]" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Avatar with Edit Button */}
              <div className="flex justify-center">
                <div className="relative">
                  <Avatar
                    src={user.avatar}
                    alt={user.name}
                    fallback={user.name}
                    size="xl"
                  />
                  <button className="
                    absolute bottom-0 right-0
                    w-8 h-8 
                    bg-[var(--surface)] 
                    border border-[var(--border)]
                    rounded-full
                    flex items-center justify-center
                    hover:bg-[var(--surface-hover)]
                    transition-colors
                    shadow-md
                  ">
                    <CameraIcon className="w-4 h-4 text-[var(--foreground)]" />
                  </button>
                </div>
              </div>

              {/* Form Fields */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-[var(--foreground-muted)] mb-1.5">
                    Display name
                  </label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="
                      w-full px-4 py-3
                      bg-[var(--surface)]
                      border border-[var(--border)]
                      rounded-xl
                      text-[var(--foreground)]
                      placeholder-[var(--foreground-muted)]
                      focus:outline-none focus:border-[var(--primary)]
                      transition-colors
                    "
                    placeholder="Your name"
                  />
                </div>

                <div>
                  <label className="block text-xs text-[var(--foreground-muted)] mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    value={editForm.email}
                    readOnly
                    disabled
                    className="
                      w-full px-4 py-3
                      bg-[var(--surface)]
                      border border-[var(--border)]
                      rounded-xl
                      text-[var(--foreground-muted)]
                      cursor-not-allowed
                      opacity-60
                    "
                  />
                  <p className="text-xs text-[var(--foreground-muted)] mt-1">
                    Email is managed by your Google account
                  </p>
                </div>

                {/* Appearance Dropdown */}
                <div>
                  <label className="block text-xs text-[var(--foreground-muted)] mb-1.5">
                    Appearance
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsAppearanceOpen(!isAppearanceOpen)}
                      className="
                        w-full px-4 py-3
                        bg-[var(--surface)]
                        border border-[var(--border)]
                        rounded-xl
                        text-[var(--foreground)]
                        text-left
                        flex items-center justify-between
                        focus:outline-none focus:border-[var(--primary)]
                        transition-colors
                      "
                    >
                      <span>{currentAppearanceLabel}</span>
                      <ChevronDownIcon className={`w-4 h-4 transition-transform ${isAppearanceOpen ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {isAppearanceOpen && (
                      <div className="
                        absolute top-full left-0 right-0 mt-1
                        bg-[var(--surface)]
                        border border-[var(--border)]
                        rounded-xl
                        shadow-lg
                        overflow-hidden
                        z-10
                      ">
                        {appearanceOptions.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                              setTheme(option.value);
                              setIsAppearanceOpen(false);
                            }}
                            className={`
                              w-full px-4 py-3
                              text-left text-sm
                              flex items-center justify-between
                              hover:bg-[var(--surface-hover)]
                              transition-colors
                              ${theme === option.value ? 'text-[var(--primary)]' : 'text-[var(--foreground)]'}
                            `}
                          >
                            <span>{option.label}</span>
                            {theme === option.value && (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Helper Text */}
              <p className="text-xs text-[var(--foreground-muted)] text-center">
                Your display name is shown in conversations and helps others recognize you.
              </p>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 p-4 border-t border-[var(--border)]">
              <button
                onClick={() => setIsEditProfileOpen(false)}
                disabled={isSaving}
                className="
                  px-5 py-2.5
                  rounded-xl
                  text-sm font-medium
                  text-[var(--foreground)]
                  hover:bg-[var(--surface-hover)]
                  transition-colors
                  disabled:opacity-50
                "
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProfile}
                disabled={isSaving}
                className="
                  px-5 py-2.5
                  rounded-xl
                  text-sm font-medium
                  bg-[var(--foreground)]
                  text-[var(--background)]
                  hover:opacity-90
                  transition-opacity
                  disabled:opacity-50
                "
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* User Management Modal */}
      {isUserManagementOpen && (
        <UserManagementModal onClose={() => setIsUserManagementOpen(false)} />
      )}
    </>
  );
}
