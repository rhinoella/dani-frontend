'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import ChatLayout from '@/components/layouts/ChatLayout';
import FilePreviewModal from '@/components/chat/FilePreviewModal';
import { useAuth } from '@/contexts/AuthContext';
import {
  uploadDocument,
  listDocuments,
  deleteDocument,
  getConversations,
  DocumentResponse,
  DocumentUploadResponse,
  waitForDocumentReady,
  ApiError,
} from '@/services/api';
import { Conversation } from '@/types';

// Icons
const UploadIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
);

const DocumentIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const TrashIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const EyeIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

const RefreshIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const DownloadIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

const SearchIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

interface UploadingFile {
  id: string;
  file: File;
  progress: number;
  status: 'queued' | 'uploading' | 'processing' | 'completed' | 'failed';
  error?: string;
  response?: DocumentUploadResponse;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function getFileType(filename: string): 'pdf' | 'docx' | 'txt' {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf': return 'pdf';
    case 'doc':
    case 'docx': return 'docx';
    default: return 'txt';
  }
}

function getStatusBadge(status: string) {
  const styles: Record<string, string> = {
    completed: 'bg-green-500/20 text-green-400 border-green-500/30',
    processing: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    failed: 'bg-red-500/20 text-red-400 border-red-500/30',
  };
  return styles[status] || styles.pending;
}

const MAX_CONCURRENT_UPLOADS = 3;

function DocumentsPageContent() {
  const router = useRouter();
  const { signOut: logout } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [documents, setDocuments] = useState<DocumentResponse[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<{ id: string; filename: string; fileType: 'pdf' | 'docx' | 'txt' } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadQueueRef = useRef<UploadingFile[]>([]);
  const activeUploadsRef = useRef(0);

  // Fetch conversations for sidebar
  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const response = await getConversations();
        setConversations((response.conversations || []).map(c => ({
          id: c.id,
          title: c.title || 'New Conversation',
          messages: [],
          createdAt: new Date(c.created_at),
          updatedAt: new Date(c.updated_at || c.created_at),
        })));
      } catch (error) {
        console.error('Failed to fetch conversations:', error);
      }
    };
    fetchConversations();
  }, []);

  // Fetch documents
  const fetchDocuments = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await listDocuments(0, 100);
      setDocuments(response.documents);
    } catch (error) {
      console.error('Failed to fetch documents:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Process upload queue with concurrency limit
  const processUploadQueue = useCallback(async () => {
    while (uploadQueueRef.current.length > 0 && activeUploadsRef.current < MAX_CONCURRENT_UPLOADS) {
      const fileToUpload = uploadQueueRef.current.shift();
      if (!fileToUpload) break;

      activeUploadsRef.current++;

      setUploadingFiles(prev => prev.map(f => 
        f.id === fileToUpload.id ? { ...f, status: 'uploading' as const } : f
      ));

      try {
        const response = await uploadDocument(
          fileToUpload.file,
          undefined,
          undefined,
          (progress) => {
            setUploadingFiles(prev => prev.map(f =>
              f.id === fileToUpload.id ? { ...f, progress } : f
            ));
          }
        );

        setUploadingFiles(prev => prev.map(f =>
          f.id === fileToUpload.id ? { ...f, status: 'processing' as const, progress: 100, response } : f
        ));

        const finalDoc = await waitForDocumentReady(response.id);
        
        if (finalDoc.status === 'completed') {
          setUploadingFiles(prev => prev.map(f =>
            f.id === fileToUpload.id ? { ...f, status: 'completed' as const } : f
          ));
        } else {
          setUploadingFiles(prev => prev.map(f =>
            f.id === fileToUpload.id ? { ...f, status: 'failed' as const, error: finalDoc.error_message || 'Processing failed' } : f
          ));
        }

        fetchDocuments();

      } catch (error) {
        console.error('Upload failed:', error);
        const errorMessage = error instanceof ApiError ? error.message : 'Upload failed';
        setUploadingFiles(prev => prev.map(f =>
          f.id === fileToUpload.id ? { ...f, status: 'failed' as const, error: errorMessage } : f
        ));
      } finally {
        activeUploadsRef.current--;
        processUploadQueue();
      }
    }
  }, [fetchDocuments]);

  const handleFiles = useCallback((files: FileList | File[]) => {
    const newFiles: UploadingFile[] = Array.from(files).map(file => ({
      id: `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      progress: 0,
      status: 'queued' as const,
    }));

    setUploadingFiles(prev => [...prev, ...newFiles]);
    uploadQueueRef.current.push(...newFiles);
    processUploadQueue();
  }, [processUploadQueue]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleDelete = async (documentId: string) => {
    setIsDeleting(true);
    try {
      await deleteDocument(documentId);
      setDocuments(prev => prev.filter(d => d.id !== documentId));
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Failed to delete document:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const removeUpload = (fileId: string) => {
    setUploadingFiles(prev => prev.filter(f => f.id !== fileId));
    uploadQueueRef.current = uploadQueueRef.current.filter(f => f.id !== fileId);
  };

  const handleSelectConversation = (id: string) => {
    router.push(`/chat?conversation=${id}`);
  };

  const handleNewConversation = () => {
    router.push('/chat');
  };

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const completedUploads = uploadingFiles.filter(f => f.status === 'completed').length;
  const totalUploads = uploadingFiles.length;

  const filteredDocuments = documents.filter(doc => 
    (doc.title || doc.filename).toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <ChatLayout
      conversations={conversations}
      currentConversationId=""
      onSelectConversation={handleSelectConversation}
      onNewConversation={handleNewConversation}
      onLogout={handleLogout}
      title="Documents"
      showHeader={true}
    >
      {/* Scrollable Content */}
      <div className="h-full overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-[var(--foreground)]">Documents</h1>
            <p className="text-sm text-[var(--foreground-muted)] mt-1">Upload and manage documents for the RAG knowledge base</p>
          </div>

          {/* Upload Area */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              relative border-2 border-dashed rounded-2xl p-8 mb-8 cursor-pointer
              transition-all duration-300
              ${isDragging 
                ? 'border-[var(--primary)] bg-[var(--primary)]/10' 
                : 'border-[var(--border)] hover:border-[var(--primary)]/50 hover:bg-[var(--surface)]'
              }
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
              className="hidden"
              accept=".pdf,.doc,.docx,.txt,.md"
            />
            <div className="text-center">
              <div className={`
                w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center
                ${isDragging ? 'bg-[var(--primary)]/20' : 'bg-[var(--surface)]'}
                transition-colors
              `}>
                <UploadIcon className={`w-8 h-8 ${isDragging ? 'text-[var(--primary)]' : 'text-[var(--foreground-muted)]'}`} />
              </div>
              <h3 className="text-lg font-medium text-[var(--foreground)] mb-2">
                Drop files here or click to upload
              </h3>
              <p className="text-sm text-[var(--foreground-muted)]">
                PDF, DOCX, TXT files up to 50MB • Multiple files supported
              </p>
            </div>
          </div>

          {/* Upload Progress */}
          {uploadingFiles.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium text-[var(--foreground)]">
                  Uploading {completedUploads}/{totalUploads} files
                </h2>
                {completedUploads === totalUploads && totalUploads > 0 && (
                  <button
                    onClick={() => setUploadingFiles([])}
                    className="text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                  >
                    Clear all
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {uploadingFiles.map(upload => (
                  <div
                    key={upload.id}
                    className="flex items-center gap-4 p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)]"
                  >
                    <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center flex-shrink-0">
                      <DocumentIcon className="w-5 h-5 text-red-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--foreground)] truncate">
                        {upload.file.name}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {upload.status === 'queued' && (
                          <span className="text-xs text-[var(--foreground-muted)]">Queued...</span>
                        )}
                        {upload.status === 'uploading' && (
                          <>
                            <div className="flex-1 h-1.5 bg-[var(--border)] rounded-full overflow-hidden max-w-[200px]">
                              <div 
                                className="h-full bg-[var(--primary)] transition-all duration-300"
                                style={{ width: `${upload.progress}%` }}
                              />
                            </div>
                            <span className="text-xs text-[var(--foreground-muted)]">{upload.progress}%</span>
                          </>
                        )}
                        {upload.status === 'processing' && (
                          <span className="text-xs text-blue-400">Processing...</span>
                        )}
                        {upload.status === 'completed' && (
                          <span className="text-xs text-green-400">✓ Completed</span>
                        )}
                        {upload.status === 'failed' && (
                          <span className="text-xs text-red-400">{upload.error}</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeUpload(upload.id); }}
                      className="p-1.5 rounded-lg hover:bg-[var(--surface-hover)] text-[var(--foreground-muted)]"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Documents Table */}
          <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] overflow-hidden">
            <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between gap-4">
              <h2 className="text-lg font-medium text-[var(--foreground)] whitespace-nowrap">
                Your Documents ({filteredDocuments.length}{searchTerm && documents.length !== filteredDocuments.length ? ` / ${documents.length}` : ''})
              </h2>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--foreground-muted)]" />
                  <input
                    type="text"
                    placeholder="Search documents..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 pr-4 py-2 text-sm bg-[var(--background)] border border-[var(--border)] rounded-xl text-[var(--foreground)] placeholder-[var(--foreground-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] w-48 sm:w-64 transition-all"
                  />
                </div>
                <button
                  onClick={fetchDocuments}
                  disabled={isLoading}
                  className="p-2 rounded-lg hover:bg-[var(--surface-hover)] transition-colors border border-[var(--border)] bg-[var(--background)]"
                  title="Refresh"
                >
                  <RefreshIcon className={`w-5 h-5 text-[var(--foreground-muted)] ${isLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
            
            {isLoading && documents.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-[var(--foreground-muted)]">Loading documents...</p>
              </div>
            ) : documents.length === 0 ? (
              <div className="p-12 text-center">
                <DocumentIcon className="w-12 h-12 mx-auto mb-4 text-[var(--foreground-muted)]" />
                <p className="text-[var(--foreground-muted)]">No documents yet. Upload some files to get started.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-sm text-[var(--foreground-muted)] border-b border-[var(--border)]">
                      <th className="px-6 py-3 font-medium">Name</th>
                      <th className="px-6 py-3 font-medium">Status</th>
                      <th className="px-6 py-3 font-medium">Size</th>
                      <th className="px-6 py-3 font-medium">Uploaded</th>
                      <th className="px-6 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {filteredDocuments.map(doc => (
                      <tr key={doc.id} className="hover:bg-[var(--surface-hover)] transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center flex-shrink-0">
                              <DocumentIcon className="w-4 h-4 text-red-400" />
                            </div>
                            <div className="min-w-0">
                              <span className="text-sm font-medium text-[var(--foreground)] truncate block max-w-[200px]">
                                {doc.title || doc.filename}
                              </span>
                              <span className="text-xs text-[var(--foreground-muted)] uppercase">
                                {doc.file_type}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${getStatusBadge(doc.status)}`}>
                            {doc.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-[var(--foreground-muted)]">
                            {formatFileSize(doc.file_size)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-[var(--foreground-muted)]">
                            {formatDate(doc.created_at)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setPreviewDoc({ id: doc.id, filename: doc.filename, fileType: getFileType(doc.filename) })}
                              className="p-2 rounded-lg hover:bg-[var(--border)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
                              title="Preview"
                            >
                              <EyeIcon className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(doc.id)}
                              className="p-2 rounded-lg hover:bg-red-500/10 text-[var(--foreground-muted)] hover:text-red-400 transition-colors"
                              title="Delete"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[var(--surface)] rounded-2xl shadow-2xl p-6">
            <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">Delete Document</h3>
            <p className="text-sm text-[var(--foreground-muted)] mb-6">
              This will remove the document and all its chunks from the RAG system.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* File Preview Modal */}
      {previewDoc && (
        <FilePreviewModal
          isOpen={true}
          onClose={() => setPreviewDoc(null)}
          documentId={previewDoc.id}
          filename={previewDoc.filename}
          fileType={previewDoc.fileType}
        />
      )}
    </ChatLayout>
  );
}

export default function DocumentsPage() {
  return (
    <ProtectedRoute>
      <DocumentsPageContent />
    </ProtectedRoute>
  );
}
