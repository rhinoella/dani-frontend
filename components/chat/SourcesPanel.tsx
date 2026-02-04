'use client';

import { useState, memo, useCallback } from 'react';
import { Source } from '@/types';
import CategoryBadge from '@/components/ui/CategoryBadge';

// Format date - handles Unix timestamp (ms), ISO string, or null
function formatDate(date: string | number | null | undefined): string | null {
  if (date == null) return null;
  
  try {
    let dateObj: Date;
    
    if (typeof date === 'number') {
      // Unix timestamp in milliseconds
      dateObj = new Date(date);
    } else if (typeof date === 'string') {
      // Try parsing as ISO string or other formats
      dateObj = new Date(date);
    } else {
      return null;
    }
    
    // Check if valid date
    if (isNaN(dateObj.getTime())) return null;
    
    // Format as readable date
    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return null;
  }
}

interface SourcesPanelProps {
  isOpen: boolean;
  onClose: () => void;
  sources?: Source[];
}

// Close icon
const CloseIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

// Chevron icon for expand/collapse
const ChevronLeftIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);

const DocumentIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const CalendarIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const UserIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

export default function SourcesPanel({ isOpen, onClose, sources = [] }: SourcesPanelProps) {
  const [selectedSource, setSelectedSource] = useState<Source | null>(null);
  
  // Memoize callback to prevent unnecessary re-renders of SourcesList
  const handleSelectSource = useCallback((source: Source) => {
    setSelectedSource(source);
  }, []);

  if (!isOpen) return null;

  return (
    <>
      {/* Source Detail Modal */}
      {selectedSource && (
        <SourceDetailModal 
          source={selectedSource} 
          onClose={() => setSelectedSource(null)} 
        />
      )}

      {/* Mobile: Full-screen overlay */}
      <div className="lg:hidden fixed inset-0 z-50 bg-white">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <DocumentIcon className="w-5 h-5 text-gray-500" />
            <h2 className="font-semibold text-gray-900">Sources</h2>
            {sources.length > 0 && (
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                {sources.length}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Close sources panel"
          >
            <CloseIcon className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <SourcesList sources={sources} onSelectSource={handleSelectSource} />
        </div>
      </div>

      {/* Desktop: Side panel */}
      <div 
        className="
          hidden lg:flex lg:flex-col
          w-80 h-full flex-shrink-0 
          border-l border-gray-200 
          bg-white
          transition-all duration-300 ease-out
          overflow-hidden
        "
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <DocumentIcon className="w-5 h-5 text-gray-500" />
            <h2 className="font-semibold text-gray-900">Sources</h2>
            {sources.length > 0 && (
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                {sources.length}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Close sources panel"
          >
            <ChevronLeftIcon className="w-4 h-4 rotate-180 text-gray-400" />
          </button>
        </div>

        {/* Sources List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <SourcesList sources={sources} onSelectSource={handleSelectSource} />
        </div>
      </div>
    </>
  );
}

// Source Detail Modal
function SourceDetailModal({ source, onClose }: { source: Source; onClose: () => void }) {
  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      
      {/* Modal */}
      <div 
        className="
          relative w-full max-w-2xl max-h-[80vh] 
          bg-white border border-gray-200
          rounded-2xl shadow-2xl overflow-hidden
        "
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-200">
          <div className="flex-1 min-w-0 pr-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {source.title || 'Source Document'}
            </h3>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-gray-500">
              {source.date && (
                <span className="flex items-center gap-1">
                  <CalendarIcon className="w-4 h-4" />
                  {formatDate(source.date)}
                </span>
              )}
              {source.speakers && source.speakers.length > 0 && (
                <span className="flex items-center gap-1">
                  <UserIcon className="w-4 h-4" />
                  {source.speakers.join(', ')}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Close modal"
          >
            <CloseIcon className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Relevance Score */}
          {source.relevance_score != null && source.relevance_score > 0 && (
            <div className="mb-4 p-4 rounded-lg bg-gray-50 border border-gray-200">
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">Relevance Score</span>
                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-orange-300 to-orange-400 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(Math.round(source.relevance_score), 100)}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-gray-600">
                  {Math.round(source.relevance_score)}%
                </span>
              </div>
            </div>
          )}

          {/* Text Preview */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-600">Content</h4>
            <div className="p-4 rounded-lg bg-gray-50 border border-gray-200 max-h-96 overflow-y-auto">
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                {source.text_preview || source.text || 'No content available'}
              </p>
            </div>
          </div>

          {/* Metadata */}
          {source.transcript_id && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                Transcript ID: <code className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">{source.transcript_id}</code>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Memoized SourcesList component to prevent unnecessary re-renders
const SourcesList = memo(function SourcesList({ sources, onSelectSource }: { sources: Source[]; onSelectSource: (source: Source) => void }) {
  if (sources.length === 0) {
    return (
      <div className="text-center py-12">
        <DocumentIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
        <p className="text-sm text-gray-500">
          No source documents referenced yet.
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Sources will appear here when the AI uses referenced documents.
        </p>
      </div>
    );
  }

  return (
    <>
      {sources.map((source, index) => (
        <div
          key={`${source.transcript_id || 'source'}-${index}`}
          className="
            p-3 rounded-lg
            bg-white border border-gray-200
            hover:border-gray-300 hover:shadow-sm
            transition-all duration-200
            cursor-pointer
          "
          onClick={() => onSelectSource(source)}
        >
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-xs font-medium text-gray-600">{index + 1}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-sm font-medium text-gray-900 truncate">
                  {source.title || 'Untitled Source'}
                </h3>
                {source.meeting_category && (
                  <CategoryBadge 
                    category={source.meeting_category} 
                    confidence={source.category_confidence}
                    size="sm"
                  />
                )}
              </div>
              <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                {source.text_preview || source.text || 'No preview available'}
              </p>
              {source.date && (
                <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                  <CalendarIcon className="w-3 h-3" />
                  <span className="truncate">{formatDate(source.date)}</span>
                </p>
              )}
            </div>
          </div>
          {source.relevance_score != null && source.relevance_score > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Relevance</span>
                <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-orange-300 to-orange-400 rounded-full"
                    style={{ width: `${Math.min(Math.round(source.relevance_score), 100)}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-gray-600">
                  {Math.round(source.relevance_score)}%
                </span>
              </div>
            </div>
          )}
        </div>
      ))}
    </>
  );
});
