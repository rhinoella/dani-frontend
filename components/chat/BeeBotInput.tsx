'use client';

import { useState, useRef, useEffect, FormEvent, KeyboardEvent } from 'react';
import { generateUUID } from '@/utils/uuid';
import { getInfographicStyles } from '@/services/api';

export interface ImageGenOptions {
  style: string;
  docType: 'meeting' | 'email' | 'document' | 'note' | 'all';
  width: number;
  height: number;
}

interface BeeBotInputProps {
  onSendMessage: (message: string, attachments?: { id: string; name: string; type: 'pdf' | 'docx' | 'txt' | 'other'; size?: number }[]) => void;
  onGenerateImage?: (request: string, options: ImageGenOptions) => void;
  disabled?: boolean;
}

export default function BeeBotInput({
  onSendMessage,
  onGenerateImage,
  disabled = false,
}: BeeBotInputProps) {
  const [message, setMessage] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [attachments, setAttachments] = useState<{ id: string; name: string; type: 'pdf' | 'docx' | 'txt' | 'other'; size?: number }[]>([]);
  const [isImageMode, setIsImageMode] = useState(false);
  const [styles, setStyles] = useState<{ style: string; description: string }[]>([]);
  const [style, setStyle] = useState('');
  const [docType, setDocType] = useState<'meeting' | 'email' | 'document' | 'note' | 'all'>('all');
  const [width, setWidth] = useState(1024);
  const [height, setHeight] = useState(1024);
  const [showStyleDropdown, setShowStyleDropdown] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const styleDropdownRef = useRef<HTMLDivElement>(null);

  const loadStyles = async () => {
    try {
      const loaded = await getInfographicStyles();
      setStyles(loaded);
      if (loaded.length > 0 && !style) setStyle(loaded[0].style);
    } catch (err) {
      console.error('Failed to load styles:', err);
    }
  };

  useEffect(() => {
    if (isImageMode && styles.length === 0) loadStyles();
  }, [isImageMode]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (styleDropdownRef.current && !styleDropdownRef.current.contains(e.target as Node)) {
        setShowStyleDropdown(false);
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

  const canSubmit = message.trim() && !disabled && (!isImageMode || !!onGenerateImage);

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
              {/* Attach Icon - hide in image mode */}
              {!isImageMode && (
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

              {/* Wand Icon - only when not in image mode */}
              {!isImageMode && (
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

              <textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder={isImageMode ? 'Describe or edit an image' : 'Initiate a query or send a command to the AI...'}
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
            {!isImageMode && attachments.length > 0 && (
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

            {/* Action Buttons - always visible; Create Image toggles image mode */}
            <div className="flex items-center gap-2 px-4 pb-3 pt-1">
              <button
                type="button"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                Reasoning
              </button>
              <button
                type="button"
                onClick={() => setIsImageMode(prev => !prev)}
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
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Deep Research
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
