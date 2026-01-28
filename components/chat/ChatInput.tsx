'use client';

import { useState, useEffect, FormEvent, KeyboardEvent, useRef } from 'react';
import { SendIcon } from '@/components/ui/Icons';
import { uploadDocument, DocumentUploadResponse, ApiError, waitForDocumentReady } from '@/services/api';
import MeetingCategoryFilter from '@/components/ui/MeetingCategoryFilter';
import FilePreviewModal from './FilePreviewModal';
import { MeetingCategory } from '@/types';

interface UploadingFile {
  id: string;
  file: File;
  progress: number;
  status: 'uploading' | 'processing' | 'completed' | 'failed';
  error?: string;
  response?: DocumentUploadResponse;
}

interface ChatInputProps {
  onSendMessage: (
    message: string, 
    documentIds?: string[],
    attachments?: { id: string; name: string; type: 'pdf' | 'docx' | 'txt' | 'other'; size?: number }[]
  ) => void;
  disabled?: boolean;
  placeholder?: string;
  docType?: 'meeting' | 'email' | 'document' | 'note' | 'all';
  onDocTypeChange?: (docType: 'meeting' | 'email' | 'document' | 'note' | 'all') => void;
  meetingCategory?: MeetingCategory;
  onMeetingCategoryChange?: (category: MeetingCategory) => void;
  initialAttachments?: { id: string; name: string; type: 'pdf' | 'docx' | 'txt' | 'other'; size?: number }[];
}

// Get file type from extension
function getFileType(filename: string): 'pdf' | 'docx' | 'txt' {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf':
      return 'pdf';
    case 'doc':
    case 'docx':
      return 'docx';
    default:
      return 'txt';
  }
}

// Format file size
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ChatInput({
  onSendMessage,
  disabled = false,
  placeholder = 'Ask anything',
  docType = 'all',
  onDocTypeChange,
  meetingCategory = 'all',
  onMeetingCategoryChange,
  initialAttachments = [],
}: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Auto-resize textarea based on content
  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      // Max height of ~120px (about 5 lines)
      const maxHeight = 120;
      textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [message]);
  
  // Initialize from initialAttachments if provided
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>(() => 
    initialAttachments.map(att => ({
      id: att.id,
      file: { name: att.name, size: att.size || 0 } as File, // Mock File object for display
      progress: 100,
      status: 'completed',
      response: { id: att.id, filename: att.name, status: 'completed' } as DocumentUploadResponse
    }))
  );

  // Update when initialAttachments change (e.g. switching conversations)
  useEffect(() => {
    if (initialAttachments && initialAttachments.length > 0) {
       // Only reset if different? Or just always sync? 
       // Simplest is to sync if list is different length or IDs
       setUploadingFiles(initialAttachments.map(att => ({
        id: att.id,
        file: { name: att.name, size: att.size || 0 } as File,
        progress: 100,
        status: 'completed',
        response: { id: att.id, filename: att.name, status: 'completed' } as DocumentUploadResponse
      })));
    } else {
      setUploadingFiles([]);
    }
  }, [JSON.stringify(initialAttachments)]); // Deep compare simple objects
  const [previewFile, setPreviewFile] = useState<{
    documentId: string;
    filename: string;
    fileType: 'pdf' | 'docx' | 'txt';
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  // Check if any file is still uploading (but allow sending while processing)
  const isUploading = uploadingFiles.some(f => f.status === 'uploading');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled && !isUploading) {
      // Collect IDs and metadata of uploaded files (including processing ones - they have an ID already)
      const uploadedFiles = uploadingFiles
        .filter(f => (f.status === 'completed' || f.status === 'processing') && f.response?.id);
      
      const documentIds = uploadedFiles.map(f => f.response!.id);
      
      const attachments = uploadedFiles.map(f => ({
        id: f.response!.id,
        name: f.file.name,
        type: getFileType(f.file.name) as 'pdf' | 'docx' | 'txt' | 'other', 
        size: f.file.size
      }));
        
      onSendMessage(
        message.trim(), 
        documentIds.length > 0 ? documentIds : undefined,
        attachments.length > 0 ? attachments : undefined
      );
      setMessage('');
      setUploadingFiles([]); // Clear uploads after sending
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as FormEvent);
    }
    // Shift+Enter allows new line (default textarea behavior)
  };

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Process each file
    for (const file of Array.from(files)) {
      const fileId = `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Add to uploading files
      setUploadingFiles(prev => [...prev, {
        id: fileId,
        file,
        progress: 0,
        status: 'uploading',
      }]);

      try {
        // Upload the file with progress tracking
        const response = await uploadDocument(
          file,
          undefined, // title - let backend use filename
          undefined, // description
          (progress) => {
            setUploadingFiles(prev => prev.map(f => 
              f.id === fileId ? { ...f, progress } : f
            ));
          }
        );

        // Mark as processing (waiting for backend to finish)
        setUploadingFiles(prev => prev.map(f => 
          f.id === fileId ? { ...f, status: 'processing', progress: 100, response } : f
        ));

        // Wait for document to be fully processed
        const finalDoc = await waitForDocumentReady(response.id);
        
        if (finalDoc.status === 'completed') {
          // Mark as completed
          setUploadingFiles(prev => prev.map(f => 
            f.id === fileId ? { ...f, status: 'completed' } : f
          ));
        } else {
          // Mark as failed
          setUploadingFiles(prev => prev.map(f => 
            f.id === fileId ? { 
              ...f, 
              status: 'failed', 
              error: finalDoc.error_message || 'Processing failed' 
            } : f
          ));
        }

      } catch (error) {
        console.error('File upload failed:', error);
        
        const errorMessage = error instanceof ApiError 
          ? error.message 
          : 'Upload failed';

        setUploadingFiles(prev => prev.map(f => 
          f.id === fileId ? { ...f, status: 'failed', error: errorMessage } : f
        ));
      }
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeUpload = (e: React.MouseEvent, fileId: string) => {
    e.stopPropagation();
    setUploadingFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const openPreview = (upload: UploadingFile) => {
    if (upload.status === 'completed' && upload.response) {
      setPreviewFile({
        documentId: upload.response.id,
        filename: upload.response.filename,
        fileType: getFileType(upload.response.filename),
      });
    }
  };

  return (
    <>
      {/* File Preview Modal */}
      {previewFile && (
        <FilePreviewModal
          isOpen={true}
          onClose={() => setPreviewFile(null)}
          documentId={previewFile.documentId}
          filename={previewFile.filename}
          fileType={previewFile.fileType}
        />
      )}

      <div className="p-4 animate-fade-in-up">
        <div className="max-w-2xl mx-auto w-full">
          {/* File Upload Cards - Above input, matching reference design */}
          {uploadingFiles.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {uploadingFiles.map((upload) => (
                <div 
                  key={upload.id}
                  onClick={() => openPreview(upload)}
                  className={`
                    relative flex items-center gap-3 pl-3 pr-8 py-2.5 rounded-xl
                    bg-[var(--surface)] border border-[var(--border)]
                    ${upload.status === 'completed' ? 'cursor-pointer hover:border-[var(--primary)]/50' : ''}
                    ${upload.status === 'failed' ? 'border-red-500/50' : ''}
                    transition-all duration-200
                  `}
                >
                  {/* Red File Icon */}
                  <div className={`
                    w-10 h-12 rounded-lg flex items-center justify-center flex-shrink-0
                    ${upload.status === 'failed' ? 'bg-red-500/20' : 'bg-red-500'}
                  `}>
                    <svg 
                      className={`w-6 h-6 ${upload.status === 'failed' ? 'text-red-500' : 'text-white'}`} 
                      fill="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
                    </svg>
                  </div>
                  
                  {/* File Info */}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--foreground)] truncate max-w-[200px]">
                      {upload.file.name}
                    </p>
                    <p className="text-xs text-[var(--foreground-muted)] uppercase mt-0.5">
                      {upload.status === 'uploading' 
                        ? `Uploading ${upload.progress}%` 
                        : upload.status === 'processing'
                        ? 'Processing...'
                        : upload.status === 'failed'
                        ? upload.error
                        : getFileType(upload.file.name).toUpperCase()
                      }
                    </p>
                    
                    {/* Progress Bar - shows for uploading */}
                    {upload.status === 'uploading' && (
                      <div className="mt-1.5 w-32 h-1 rounded-full bg-[var(--border)] overflow-hidden">
                        <div 
                          className="h-full rounded-full bg-[var(--primary)] transition-all duration-300"
                          style={{ width: `${upload.progress}%` }}
                        />
                      </div>
                    )}
                    
                    {/* Indeterminate Progress Bar - shows for processing */}
                    {upload.status === 'processing' && (
                      <div className="mt-1.5 w-32 h-1 rounded-full bg-[var(--border)] overflow-hidden">
                        <div 
                          className="h-full rounded-full bg-[var(--primary)] animate-pulse"
                          style={{ width: '100%' }}
                        />
                      </div>
                    )}
                  </div>
                  
                  {/* Remove Button */}
                  <button
                    onClick={(e) => removeUpload(e, upload.id)}
                    className="absolute top-1 right-1 p-1 rounded-full bg-[var(--surface-hover)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--border)] transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}


          <form onSubmit={handleSubmit}>
            <div 
              className={`
                relative
                flex items-center 
                glass-strong rounded-2xl
                p-2 pl-4
                transition-all duration-300
                ${isFocused 
                  ? 'ring-2 ring-[var(--primary)] shadow-lg shadow-[var(--primary-glow)]' 
                  : 'hover:shadow-md'
                }
              `}
            >
              {/* Hidden File Input */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileChange}
                className="hidden"
                accept=".pdf,.doc,.docx,.txt,.md,.markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
              />
              
              {/* Plus Button with Dropdown Menu */}
              <div className="relative" ref={dropdownRef}>
                <button 
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  disabled={isUploading}
                  className={`
                    p-2 rounded-xl
                    transition-all duration-200
                    ${isDropdownOpen
                      ? 'text-[var(--primary)] bg-[var(--primary)]/10'
                      : isUploading 
                        ? 'text-[var(--primary)] animate-pulse cursor-wait'
                        : 'text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)]'
                    }
                  `}
                  title="Add content"
                >
                  <svg 
                    className={`w-5 h-5 transition-transform duration-200 ${isDropdownOpen ? 'rotate-45' : ''}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  {/* Filter active indicator */}
                  {(docType !== 'all' || meetingCategory !== 'all') && !isDropdownOpen && (
                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-[var(--primary)] rounded-full border-2 border-[var(--surface)]" />
                  )}
                </button>

                {/* Dropdown Menu */}
                {isDropdownOpen && (
                  <div 
                    className="
                      absolute bottom-full left-0 mb-2
                      w-72 max-h-80 overflow-y-auto
                      bg-[var(--surface)] border border-[var(--border)]
                      rounded-xl shadow-xl
                      animate-fade-in-up
                      z-50
                    "
                  >
                    {/* Upload Section */}
                    <div className="p-2 border-b border-[var(--border)]">
                      <button
                        type="button"
                        onClick={() => {
                          handleFileClick();
                          setIsDropdownOpen(false);
                        }}
                        className="
                          w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                          text-[var(--foreground)] hover:bg-[var(--surface-hover)]
                          transition-colors text-left
                        "
                      >
                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                          <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-medium">Upload Documents</p>
                          <p className="text-xs text-[var(--foreground-muted)]">PDF, DOCX, TXT files</p>
                        </div>
                      </button>
                    </div>

                    {/* Source Type Filter Section */}
                    {onDocTypeChange && (
                      <div className="p-3 border-b border-[var(--border)]">
                        <p className="text-xs font-medium text-[var(--foreground-muted)] uppercase tracking-wider mb-2 px-1">
                          Filter by Source Type
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {[
                            { value: 'all', label: 'All', icon: '📚' },
                            { value: 'meeting', label: 'Meetings', icon: '🎙️' },
                            { value: 'email', label: 'Emails', icon: '✉️' },
                            { value: 'document', label: 'Docs', icon: '📄' },
                            { value: 'note', label: 'Notes', icon: '📝' },
                          ].map(opt => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => {
                                onDocTypeChange(opt.value as typeof docType);
                                setIsDropdownOpen(false);
                              }}
                              className={`
                                flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm
                                transition-all duration-200
                                ${docType === opt.value
                                  ? 'bg-[var(--primary)]/10 text-[var(--primary)] font-medium'
                                  : 'text-[var(--foreground-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]'
                                }
                              `}
                            >
                              <span>{opt.icon}</span>
                              <span>{opt.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Meeting Category Filter Section */}
                    {onMeetingCategoryChange && (
                      <div className="p-3">
                        <p className="text-xs font-medium text-[var(--foreground-muted)] uppercase tracking-wider mb-2 px-1">
                          Filter by Meeting Type
                        </p>
                        <div className="space-y-1">
                          <MeetingCategoryFilter
                            value={meetingCategory}
                            onChange={(cat) => {
                              onMeetingCategoryChange(cat);
                              setIsDropdownOpen(false);
                            }}
                            vertical={true}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Text Input - Auto-expanding Textarea */}
              <textarea 
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder={placeholder}
                disabled={disabled}
                rows={1}
                className="
                  flex-1 
                  bg-transparent border-none outline-none 
                  text-[var(--foreground)] 
                  placeholder-[var(--foreground-muted)]
                  px-3 py-2
                  text-base
                  resize-none
                  overflow-y-auto
                  max-h-[120px]
                  leading-6
                "
              />

              {/* Right Action Buttons */}
              <div className="flex items-center gap-1">
                {/* Send Button */}
                <button 
                  type="submit"
                  disabled={!message.trim() || disabled || isUploading}
                  className={`
                    p-2.5 rounded-xl
                    transition-all duration-300
                    ${message.trim() && !disabled && !isUploading
                      ? 'bg-gradient-to-r from-[var(--primary)] to-purple-500 text-white shadow-lg shadow-[var(--primary-glow)] hover:scale-105 hover:shadow-xl'
                      : 'bg-[var(--surface)] text-[var(--foreground-muted)] cursor-not-allowed'
                    }
                  `}
                >
                  <SendIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          </form>
          
          {/* Helper Text */}
          <p className="text-center text-xs text-[var(--foreground-muted)] mt-3">
            DANI can make mistakes. Consider checking important information.
          </p>
        </div>
      </div>
    </>
  );
}
