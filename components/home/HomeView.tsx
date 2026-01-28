'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  SendIcon,
  SparkleIcon
} from '@/components/ui/Icons';
import ThemeToggle from '@/components/ui/ThemeToggle';
import { uploadDocument, DocumentUploadResponse, ApiError, waitForDocumentReady } from '@/services/api';
import FilePreviewModal from '@/components/chat/FilePreviewModal';
import { useAuth } from '@/contexts/AuthContext';

interface UploadingFile {
  id: string;
  file: File;
  progress: number;
  status: 'uploading' | 'processing' | 'completed' | 'failed';
  error?: string;
  response?: DocumentUploadResponse;
}

interface HomeViewProps {
  onSendMessage: (
    message: string, 
    documentIds?: string[],
    attachments?: { id: string; name: string; type: 'pdf' | 'docx' | 'txt' | 'other'; size?: number }[]
  ) => void;
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

// Default suggestions to use as fallback
const DEFAULT_SUGGESTIONS = [
  "What's the latest news today?",
  "Help me write an email",
  "Explain quantum computing",
  "Create a workout plan",
];

export default function HomeView({ onSendMessage }: HomeViewProps) {
  const { user } = useAuth();
  const [inputValue, setInputValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [previewFile, setPreviewFile] = useState<{
    documentId: string;
    filename: string;
    fileType: 'pdf' | 'docx' | 'txt';
  } | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>(DEFAULT_SUGGESTIONS);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
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
  }, [inputValue]);

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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && inputValue.trim() && !isUploading) {
      // Collect IDs of uploaded files (including processing ones - they have an ID already)
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
        inputValue.trim(), 
        documentIds.length > 0 ? documentIds : undefined,
        attachments.length > 0 ? attachments : undefined
      );
      setInputValue('');
      setUploadingFiles([]); // Clear uploads after sending
    }
  };

  const handleSubmit = () => {
    if (inputValue.trim() && !isUploading) {
      // Collect IDs of uploaded files (including processing ones - they have an ID already)
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
        inputValue.trim(), 
        documentIds.length > 0 ? documentIds : undefined,
        attachments.length > 0 ? attachments : undefined
      );
      setInputValue('');
      setUploadingFiles([]); // Clear uploads after sending
    }
  };

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      const fileId = `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      setUploadingFiles(prev => [...prev, {
        id: fileId,
        file,
        progress: 0,
        status: 'uploading',
      }]);

      try {
        const response = await uploadDocument(
          file,
          undefined,
          undefined,
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
        const errorMessage = error instanceof ApiError ? error.message : 'Upload failed';
        setUploadingFiles(prev => prev.map(f => 
          f.id === fileId ? { ...f, status: 'failed', error: errorMessage } : f
        ));
      }
    }

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

  // Get user's first name for personalized greeting
  const firstName = user?.name ? user.name.split(' ')[0] : 'there';

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

      <div className="flex flex-col items-center justify-center min-h-full h-full px-4 py-8 relative overflow-hidden">
        {/* Theme Toggle - Top Right */}
        <div className="absolute top-4 right-4 lg:hidden">
          <ThemeToggle />
        </div>

        {/* Decorative Background Elements */}
        <div className="absolute inset-0 overflow-hidden -z-10">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-gradient-to-r from-[var(--primary)]/20 to-purple-500/20 rounded-full blur-3xl animate-float" />
          <div className="absolute top-1/2 left-1/4 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl" style={{ animationDelay: '1s' }} />
          <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl" style={{ animationDelay: '2s' }} />
        </div>

        {/* Logo Area */}
        <div className="mb-10 flex flex-col items-center animate-fade-in-down">
          <div className="relative mb-6">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[var(--primary)] to-purple-500 flex items-center justify-center shadow-2xl shadow-[var(--primary-glow)] animate-float">
              <SparkleIcon className="w-10 h-10 text-white" />
            </div>
            <div className="absolute inset-0 w-20 h-20 rounded-2xl bg-gradient-to-br from-[var(--primary)] to-purple-500 blur-xl opacity-50 -z-10 animate-pulse-glow" />
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3">
            <span className="gradient-text">DANI</span>
          </h1>
          <p className="text-lg text-[var(--foreground-secondary)] text-center max-w-md">
            Hello {firstName} ! How can I help you today?
          </p>
        </div>

        {/* File Upload Cards */}
        {uploadingFiles.length > 0 && (
          <div className="w-full max-w-2xl mb-4 flex flex-wrap gap-2 animate-fade-in-up">
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

        {/* Search Input Area */}
        <div className="w-full max-w-2xl mb-6 animate-fade-in-up">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileChange}
            className="hidden"
            accept=".pdf,.doc,.docx,.txt,.md,.markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
          />

          <div 
            className={`
              relative flex items-center 
              glass-strong rounded-2xl
              p-2 pl-4
              transition-all duration-300
              ${isFocused 
                ? 'ring-2 ring-[var(--primary)] shadow-2xl shadow-[var(--primary-glow)]' 
                : 'shadow-lg hover:shadow-xl'
              }
            `}
          >
            {/* Plus Button with Dropdown Menu */}
            <div className="relative" ref={dropdownRef}>
              <button 
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                disabled={isUploading}
                className={`
                  p-2.5 rounded-xl transition-all duration-200
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
              </button>

              {/* Dropdown Menu */}
              {isDropdownOpen && (
                <div 
                  className="
                    absolute bottom-full left-0 mb-2
                    w-64
                    bg-[var(--surface)] border border-[var(--border)]
                    rounded-xl shadow-xl
                    animate-fade-in-up
                    z-50
                  "
                >
                  <div className="p-2">
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
                </div>
              )}
            </div>

            {/* Text Input - Auto-expanding Textarea */}
            <textarea 
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="What do you want to know?"
              rows={1}
              className="
                flex-1 bg-transparent border-none outline-none 
                text-[var(--foreground)] placeholder-[var(--foreground-muted)]
                px-3 py-3
                text-lg
                resize-none
                overflow-y-auto
                max-h-[120px]
                leading-7
              "
            />

            {/* Right Actions */}
            <div className="flex items-center gap-1">
              <button 
                onClick={handleSubmit}
                disabled={!inputValue.trim() || isUploading}
                className={`
                  p-3 rounded-xl transition-all duration-300
                  ${inputValue.trim() && !isUploading
                    ? 'bg-gradient-to-r from-[var(--primary)] to-purple-500 text-white shadow-lg shadow-[var(--primary-glow)] hover:scale-105 hover:shadow-xl'
                    : 'bg-[var(--surface)] text-[var(--foreground-muted)]'
                  }
                `}
              >
                <SendIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Suggestions */}
        <div className="w-full max-w-2xl animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          <p className="text-sm text-[var(--foreground-muted)] text-center mb-3">Try asking:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => setInputValue(suggestion)}
                className="
                  p-3 rounded-xl
                  glass
                  text-left text-sm text-[var(--foreground-secondary)]
                  hover:text-[var(--foreground)]
                  hover:shadow-md hover:-translate-y-0.5
                  transition-all duration-200
                "
              >
                &ldquo;{suggestion}&rdquo;
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
