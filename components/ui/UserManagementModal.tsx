import { useState, useEffect } from 'react';
import { CloseIcon } from '@/components/ui/Icons';
import Avatar from '@/components/ui/Avatar';
import { adminListUsers, adminCreateUser, adminUpdateUser, adminDeleteUser, UserResponse } from '@/services/api';

interface User {
  id: string;
  name: string;
  email: string;
  picture_url?: string | null;
}

interface UserManagementModalProps {
  onClose: () => void;
}

export default function UserManagementModal({ onClose }: UserManagementModalProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // New user form state
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit state
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const data = await adminListUsers();
      setUsers(data);
      setError(null);
    } catch (err) {
      setError('Failed to load users');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newEmail) return;

    try {
      setIsSubmitting(true);
      await adminCreateUser({ name: newName, email: newEmail });
      setNewName('');
      setNewEmail('');
      setIsAdding(false);
      await fetchUsers(); // Refresh list
    } catch (err) {
      setError('Failed to create user');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEditing = (user: User) => {
    setEditingUserId(user.id);
    setEditName(user.name);
  };

  const saveEdit = async () => {
    if (!editingUserId) return;
    try {
      await adminUpdateUser(editingUserId, { name: editName });
      setEditingUserId(null);
      await fetchUsers();
    } catch (err) {
      setError('Failed to update user');
      console.error(err);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      await adminDeleteUser(id);
      await fetchUsers();
    } catch (err) {
      setError('Failed to delete user');
      console.error(err);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-2xl glass-strong rounded-2xl shadow-2xl animate-scale-in overflow-hidden flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            Manage Users
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
          >
            <CloseIcon className="w-5 h-5 text-[var(--foreground-muted)]" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm">
              {error}
            </div>
          )}

          {/* User List */}
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-medium text-[var(--foreground-muted)]">
                {users.length} Users
              </h3>
              {!isAdding && (
                <button
                  onClick={() => setIsAdding(true)}
                  className="px-3 py-1.5 text-sm bg-[var(--foreground)] text-[var(--background)] rounded-lg hover:opacity-90 transition-opacity"
                >
                  Add User
                </button>
              )}
            </div>

            {isAdding && (
              <form onSubmit={handleAddUser} className="mb-6 p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
                <h4 className="text-sm font-medium mb-3">New User</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <input
                    type="text"
                    placeholder="Name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm"
                    required
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm"
                    required
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="px-3 py-1.5 text-sm hover:bg-[var(--surface-hover)] rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-3 py-1.5 text-sm bg-[var(--foreground)] text-[var(--background)] rounded-lg hover:opacity-90 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Adding...' : 'Add User'}
                  </button>
                </div>
              </form>
            )}

            {isLoading ? (
              <div className="text-center py-8 text-[var(--foreground-muted)]">
                Loading users...
              </div>
            ) : (
              <div className="space-y-2">
                {users.map((user) => (
                  <div 
                    key={user.id} 
                    className="flex items-center gap-3 p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)]"
                  >
                    <Avatar src={user.picture_url ?? undefined} alt={user.name} fallback={user.name} size="sm" />
                    
                    <div className="flex-1 min-w-0">
                      {editingUserId === user.id ? (
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full px-2 py-1 rounded bg-[var(--background)] border border-[var(--border)] text-sm"
                          autoFocus
                        />
                      ) : (
                        <div className="font-medium text-sm truncate">{user.name}</div>
                      )}
                      <div className="text-xs text-[var(--foreground-muted)] truncate">{user.email}</div>
                    </div>

                    <div className="flex items-center gap-2">
                      {editingUserId === user.id ? (
                        <>
                          <button
                            onClick={saveEdit}
                            className="text-xs px-2 py-1 bg-green-500/10 text-green-500 rounded hover:bg-green-500/20"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingUserId(null)}
                            className="text-xs px-2 py-1 hover:bg-[var(--surface-hover)] rounded"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => startEditing(user)}
                          className="p-1.5 text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] rounded-lg transition-colors"
                          title="Edit"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                      )}
                      
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
