'use client';

import { useState, useRef, useEffect } from 'react';
import { Message } from '@/types';
import { CopyIcon, ThumbsUpIcon, ThumbsDownIcon } from '@/components/ui/Icons';

// Static Pulsating Sphere for AI (no animation)
const StaticSphere = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas first
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = 14;

    const gradient = ctx.createRadialGradient(
      centerX,
      centerY,
      0,
      centerX,
      centerY,
      radius
    );

    gradient.addColorStop(0, 'rgba(255, 140, 0, 1)');
    gradient.addColorStop(0.3, 'rgba(255, 100, 80, 0.9)');
    gradient.addColorStop(0.5, 'rgba(255, 120, 150, 0.6)');
    gradient.addColorStop(0.7, 'rgba(255, 180, 200, 0.3)');
    gradient.addColorStop(1, 'rgba(255, 200, 200, 0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fill();
  }, []);

  return <canvas ref={canvasRef} width={32} height={32} className="rounded-full block" />;
};

interface ChatMessageProps {
  message: Message;
  isLoading?: boolean;
  isSelected?: boolean;
  onRegenerate?: () => void;
  onSelectMessage?: (messageId: string) => void;
  onEdit?: (messageId: string, newContent: string) => void;
  userPictureUrl?: string | null;
}

export default function ChatMessage({ message, isLoading, isSelected, onSelectMessage, onEdit, userPictureUrl }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFeedback = (type: 'up' | 'down') => {
    setFeedback(feedback === type ? null : type);
  };

  return (
    <div className="flex flex-col py-3 px-8 animate-fade-in-up">
      <div className="max-w-3xl w-full">
        <div className="flex items-start gap-3">
          {/* Avatar/Icon */}
          <div className="flex-shrink-0 mt-1">
            {isUser ? (
              userPictureUrl ? (
                <img 
                  src={userPictureUrl} 
                  alt="User" 
                  className="w-6 h-6 rounded-full object-cover border border-gray-200"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-gray-200 border border-gray-200 flex items-center justify-center">
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              )
            ) : (
              <div className="w-12 h-12 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
                <StaticSphere />
              </div>
            )}
          </div>

          {/* Message Bubble */}
          <div className="flex-1 min-w-0">
            <div
                      className={`
                rounded-2xl px-4 py-3
                        ${isUser 
                  ? 'bg-white border border-gray-200' 
                  : 'bg-gradient-to-br from-orange-50 to-orange-100/50 border border-orange-200/50'
                }
              `}
            >
              {isLoading ? (
                <div className="flex items-center gap-2 text-gray-500">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-sm">Thinking...</span>
                </div>
              ) : (
                <div className={`whitespace-pre-wrap break-words text-sm leading-relaxed ${isUser ? 'text-gray-900' : 'text-gray-800'}`}>
                  {message.content}
                </div>
              )}
            </div>

        {/* Action Buttons - Only for assistant messages */}
        {!isUser && !isLoading && (
              <div className="flex items-center gap-2 mt-2 px-1">
                {/* Thumbs Up/Down */}
            <button
              onClick={() => handleFeedback('up')}
              className={`
                    p-1.5 rounded-lg transition-colors
                ${feedback === 'up'
                      ? 'text-[#FF8C00] bg-orange-100'
                      : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                }
              `}
              title="Good response"
            >
              <ThumbsUpIcon className="w-4 h-4" />
            </button>
            
            <button
              onClick={() => handleFeedback('down')}
              className={`
                    p-1.5 rounded-lg transition-colors
                ${feedback === 'down'
                      ? 'text-red-500 bg-red-50'
                      : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                }
              `}
              title="Bad response"
            >
              <ThumbsDownIcon className="w-4 h-4" />
            </button>

                {/* Copy Button */}
                <button
                  onClick={handleCopy}
                  className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1.5"
                  title="Copy"
                >
                  <CopyIcon className="w-3.5 h-3.5" />
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
