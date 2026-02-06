'use client';

import React, { useState, useRef, useEffect, useCallback, FormEvent, KeyboardEvent } from 'react';
import { generateUUID } from '@/utils/uuid';
import { getInfographicStyles, getContentTypes } from '@/services/api';

export interface ImageGenOptions {
  style: string;
  docType: 'meeting' | 'email' | 'document' | 'note' | 'all';
  width: number;
  height: number;
}

export interface GhostwriterOptions {
  contentType: string;
  docType: 'meeting' | 'email' | 'document' | 'note' | 'all';
  tone?: string;
}

interface BeeBotInputProps {
  onSendMessage: (message: string, attachments?: { id: string; name: string; type: 'pdf' | 'docx' | 'txt' | 'other'; size?: number }[]) => void;
  onGenerateImage?: (request: string, options: ImageGenOptions) => void;
  onGenerateGhostwriter?: (request: string, options: GhostwriterOptions) => void;
  disabled?: boolean;
}

// Icons for content types (no emojis)
const ContentTypeIcons: Record<string, React.ReactNode> = {
  linkedin_post: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  email: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  blog_draft: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
  tweet_thread: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  ),
  newsletter: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
    </svg>
  ),
  meeting_summary: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  ),
};

const DEFAULT_CONTENT_TYPES = [
  { type: 'linkedin_post', label: 'LinkedIn Post' },
  { type: 'email', label: 'Email' },
  { type: 'blog_draft', label: 'Blog Post' },
  { type: 'tweet_thread', label: 'Tweet Thread' },
  { type: 'newsletter', label: 'Newsletter' },
  { type: 'meeting_summary', label: 'Meeting Summary' },
];

const TONE_OPTIONS = [
  { value: '', label: 'Auto' },
  { value: 'formal', label: 'Formal' },
  { value: 'casual', label: 'Casual' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'inspirational', label: 'Inspirational' },
];

export default function BeeBotInput({
  onSendMessage,
  onGenerateImage,
  onGenerateGhostwriter,
  disabled = false,
}: BeeBotInputProps) {
  const [message, setMessage] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [attachments, setAttachments] = useState<{ id: string; name: string; type: 'pdf' | 'docx' | 'txt' | 'other'; size?: number }[]>([]);
  const [isImageMode, setIsImageMode] = useState(false);
  const [isGhostwriterMode, setIsGhostwriterMode] = useState(false);
  const [styles, setStyles] = useState<{ style: string; description: string }[]>([]);
  const [style, setStyle] = useState('');
  const [contentTypes, setContentTypes] = useState<{ type: string; label: string }[]>(DEFAULT_CONTENT_TYPES);
  const [contentType, setContentType] = useState('linkedin_post');
  const [ghostwriterDocType, setGhostwriterDocType] = useState<'meeting' | 'email' | 'document' | 'note' | 'all'>('all');
  const [tone, setTone] = useState('');
  const [docType, setDocType] = useState<'meeting' | 'email' | 'document' | 'note' | 'all'>('all');
  const [width, setWidth] = useState(1024);
  const [height, setHeight] = useState(1024);
  const [showStyleDropdown, setShowStyleDropdown] = useState(false);
  const [showContentTypeDropdown, setShowContentTypeDropdown] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const styleDropdownRef = useRef<HTMLDivElement>(null);
  const contentTypeDropdownRef = useRef<HTMLDivElement>(null);

  const loadStyles = async () => {
    try {
      const loaded = await getInfographicStyles();
      setStyles(loaded);
      if (loaded.length > 0 && !style) setStyle(loaded[0].style);
    } catch (err) {
      console.error('Failed to load styles:', err);
    }
  };

  const loadContentTypes = useCallback(async () => {
    try {
      const types = await getContentTypes();
      if (types.length > 0) {
        setContentTypes(
          types.map((t) => ({
            type: t.type,
            label: t.type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
          }))
        );
        setContentType((prev) => (types.some((t) => t.type === prev) ? prev : types[0].type));
      }
    } catch (err) {
      console.error('Failed to load content types:', err);
    }
  }, []);

  useEffect(() => {
    if (isImageMode && styles.length === 0) loadStyles();
  }, [isImageMode]);

  useEffect(() => {
    if (isGhostwriterMode) loadContentTypes();
  }, [isGhostwriterMode]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (styleDropdownRef.current && !styleDropdownRef.current.contains(e.target as Node)) {
        setShowStyleDropdown(false);
      }
      if (contentTypeDropdownRef.current && !contentTypeDropdownRef.current.contains(e.target as Node)) {
        setShowContentTypeDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [message]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!message.trim() || disabled) return;

    if (isImageMode && onGenerateImage) {
      onGenerateImage(message.trim(), { style, docType, width, height });
      setMessage('');
    } else if (isGhostwriterMode && onGenerateGhostwriter) {
      onGenerateGhostwriter(message.trim(), { contentType, docType: ghostwriterDocType, tone: tone || undefined });
      setMessage('');
    } else {
      onSendMessage(message.trim(), attachments.length > 0 ? attachments : undefined);
      setMessage('');
      setAttachments([]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newAttachments = Array.from(files).map(file => {
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      let fileType: 'pdf' | 'docx' | 'txt' | 'other' = 'other';

      if (fileExtension === 'pdf') fileType = 'pdf';
      else if (fileExtension === 'docx' || fileExtension === 'doc') fileType = 'docx';
      else if (fileExtension === 'txt') fileType = 'txt';

      return {
        id: generateUUID(),
        name: file.name,
        type: fileType,
        size: file.size,
      };
    });

    setAttachments(prev => [...prev, ...newAttachments]);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(att => att.id !== id));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as FormEvent);
    }
  };

  const canSubmit =
    message.trim() &&
    !disabled &&
    (!isImageMode || !!onGenerateImage) &&
    (!isGhostwriterMode || !!onGenerateGhostwriter);

  return (
    <div className="px-8 py-6 bg-white">
      <div className="max-w-3xl mx-auto">
        <form onSubmit={handleSubmit}>
          <div className={`relative bg-[#F5F5F5] rounded-[20px] border shadow-sm transition-all ${
            isFocused
              ? 'border-[#FF8C00] ring-2 ring-[#FF8C00]/20'
              : 'border-gray-200'
          }`}>
            <div className="flex items-center gap-2 px-4 py-3">
              {/* Attach Icon - hide in image/ghostwriter mode */}
              {!isImageMode && !isGhostwriterMode && (
                <>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                    title="Attach file"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                    accept=".pdf,.doc,.docx,.txt"
                  />
                </>
              )}

              {/* Wand Icon - only when not in image/ghostwriter mode */}
              {!isImageMode && !isGhostwriterMode && (
                <div className="text-[#FF8C00]">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                </div>
              )}

              {/* Styles dropdown - only in image mode */}
              {isImageMode && (
                <div ref={styleDropdownRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setShowStyleDropdown(prev => !prev)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#FF8C00] bg-[#FF8C00]/10 hover:bg-[#FF8C00]/20 rounded-lg transition-colors border border-[#FF8C00]/30"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                    </svg>
                    {style ? style.charAt(0).toUpperCase() + style.slice(1) : 'Style'}
                    <svg className={`w-3 h-3 transition-transform ${showStyleDropdown ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {showStyleDropdown && (
                    <div className="absolute left-0 top-full mt-1 z-50 py-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto min-w-[180px]">
                      {styles.map((s) => (
                        <button
                          key={s.style}
                          type="button"
                          onClick={() => {
                            setStyle(s.style);
                            setShowStyleDropdown(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-100 transition-colors ${
                            style === s.style ? 'bg-orange-50 text-[#FF8C00] font-medium' : 'text-gray-700'
                          }`}
                        >
                          <span className="block">{s.style.charAt(0).toUpperCase() + s.style.slice(1)}</span>
                          {s.description && <span className="block text-[10px] text-gray-500 mt-0.5 truncate">{s.description}</span>}
                        </button>
                      ))}
                      {styles.length === 0 && <div className="px-3 py-2 text-xs text-gray-500">Loading styles...</div>}
                    </div>
                  )}
                </div>
              )}

              {/* Content type dropdown - only in ghostwriter mode */}
              {isGhostwriterMode && (
                <div ref={contentTypeDropdownRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setShowContentTypeDropdown((prev) => !prev)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#FF8C00] bg-[#FF8C00]/10 hover:bg-[#FF8C00]/20 rounded-lg transition-colors border border-[#FF8C00]/30"
                  >
                    <span className="text-gray-600">
                      {ContentTypeIcons[contentType] ?? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      )}
                    </span>
                    {contentTypes.find((c) => c.type === contentType)?.label ?? 'Type'}
                    <svg className={`w-3 h-3 transition-transform ${showContentTypeDropdown ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {showContentTypeDropdown && (
                    <div className="absolute left-0 top-full mt-1 z-50 py-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto min-w-[180px]">
                      {contentTypes.map((c) => (
                        <button
                          key={c.type}
                          type="button"
                          onClick={() => {
                            setContentType(c.type);
                            setShowContentTypeDropdown(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-100 transition-colors flex items-center gap-2 ${
                            contentType === c.type ? 'bg-orange-50 text-[#FF8C00] font-medium' : 'text-gray-700'
                          }`}
                        >
                          <span className="text-gray-600">
                            {ContentTypeIcons[c.type] ?? (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            )}
                          </span>
                          <span>{c.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder={
                  isImageMode
                    ? 'Describe or edit an image'
                    : isGhostwriterMode
                      ? 'What do you want to write?'
                      : 'Initiate a query or send a command to the AI...'
                }
                disabled={disabled}
                rows={1}
                className="flex-1 bg-transparent border-none outline-none resize-none text-gray-700 placeholder:text-gray-400 text-sm leading-6 max-h-[120px] focus:outline-none focus:ring-0 focus:border-none focus-visible:outline-none focus-visible:ring-0"
                style={{ outline: 'none', boxShadow: 'none' }}
              />

              <button
                type="submit"
                disabled={!canSubmit}
                className={`p-2 rounded-xl transition-all ${
                  canSubmit
                    ? 'bg-gradient-to-r from-[#FF8C00] to-[#FF6B35] text-white shadow-lg hover:shadow-xl'
                    : 'bg-gray-300 text-gray-400 cursor-not-allowed'
                }`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
              </button>
            </div>

            {/* Ghostwriter mode: Source, Tone row */}
            {isGhostwriterMode && (
              <div className="flex flex-wrap items-center gap-3 px-4 pb-3 pt-1 border-t border-gray-200/60 mt-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Source</span>
                  <select
                    value={ghostwriterDocType}
                    onChange={(e) => setGhostwriterDocType(e.target.value as typeof ghostwriterDocType)}
                    className="px-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:border-[#FF8C00] focus:ring-1 focus:ring-[#FF8C00]/30"
                  >
                    <option value="all">All Sources</option>
                    <option value="meeting">Meetings</option>
                    <option value="document">Documents</option>
                    <option value="email">Emails</option>
                    <option value="note">Notes</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Tone</span>
                  <select
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                    className="px-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:border-[#FF8C00] focus:ring-1 focus:ring-[#FF8C00]/30"
                  >
                    {TONE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Image mode: Source, Width, Height row */}
            {isImageMode && (
              <div className="flex flex-wrap items-center gap-3 px-4 pb-3 pt-1 border-t border-gray-200/60 mt-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Source</span>
                  <select
                    value={docType}
                    onChange={(e) => setDocType(e.target.value as typeof docType)}
                    className="px-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:border-[#FF8C00] focus:ring-1 focus:ring-[#FF8C00]/30"
                  >
                    <option value="all">All Sources</option>
                    <option value="meeting">Meetings</option>
                    <option value="document">Documents</option>
                    <option value="email">Emails</option>
                    <option value="note">Notes</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Width</span>
                  <input
                    type="number"
                    value={width}
                    onChange={(e) => setWidth(Math.min(2048, Math.max(512, parseInt(e.target.value) || 1024)))}
                    min={512}
                    max={2048}
                    step={128}
                    className="w-20 px-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:border-[#FF8C00] focus:ring-1 focus:ring-[#FF8C00]/30"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Height</span>
                  <input
                    type="number"
                    value={height}
                    onChange={(e) => setHeight(Math.min(2048, Math.max(512, parseInt(e.target.value) || 1024)))}
                    min={512}
                    max={2048}
                    step={128}
                    className="w-20 px-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:border-[#FF8C00] focus:ring-1 focus:ring-[#FF8C00]/30"
                  />
                </div>
              </div>
            )}

            {/* Attachments Preview */}
            {!isImageMode && !isGhostwriterMode && attachments.length > 0 && (
              <div className="px-4 pb-2 flex flex-wrap gap-2">
                {attachments.map(att => (
                  <div key={att.id} className="flex items-center gap-2 px-2 py-1 bg-gray-100 rounded-lg text-xs">
                    <span className="text-gray-700">{att.name}</span>
                    <button type="button" onClick={() => removeAttachment(att.id)} className="text-gray-400 hover:text-gray-600">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Action Buttons - always visible; Ghostwriter and Create Image toggle modes */}
            <div className="flex items-center gap-2 px-4 pb-3 pt-1">
              <button
                type="button"
                onClick={() => {
                  setIsGhostwriterMode((prev) => !prev);
                  if (isGhostwriterMode) return;
                  setIsImageMode(false);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  isGhostwriterMode
                    ? 'bg-[#FF8C00]/20 text-[#FF8C00] border border-[#FF8C00]/50 hover:bg-[#FF8C00]/30'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                Ghostwriter
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsImageMode((prev) => !prev);
                  if (isImageMode) return;
                  setIsGhostwriterMode(false);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  isImageMode
                    ? 'bg-[#FF8C00]/20 text-[#FF8C00] border border-[#FF8C00]/50 hover:bg-[#FF8C00]/30'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Create Image
              </button>
              <button
                type="button"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                title="Help"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Help
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
