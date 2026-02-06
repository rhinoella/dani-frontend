'use client';

import { useState, useEffect } from 'react';
import { generateInfographic, getInfographicStyles, regenerateImageUrl, InfographicRequest, InfographicResponse } from '@/services/api';

interface CreateImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialRequest?: string;
}

export default function CreateImageModal({ isOpen, onClose, initialRequest = '' }: CreateImageModalProps) {
  const [request, setRequest] = useState(initialRequest);
  const [style, setStyle] = useState<string>('');
  const [styles, setStyles] = useState<{ style: string; description: string }[]>([]);
  const [docType, setDocType] = useState<'meeting' | 'email' | 'document' | 'note' | 'all'>('all');
  const [width, setWidth] = useState(1024);
  const [height, setHeight] = useState(1024);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<InfographicResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setRequest(initialRequest);
      setResult(null);
      setError(null);
      loadStyles();
    }
  }, [isOpen, initialRequest]);

  const loadStyles = async () => {
    try {
      const loadedStyles = await getInfographicStyles();
      setStyles(loadedStyles);
      if (loadedStyles.length > 0 && !style) {
        setStyle(loadedStyles[0].style);
      }
    } catch (err) {
      console.error('Failed to load styles:', err);
    }
  };

  const handleGenerate = async () => {
    if (!request.trim() || !style) return;

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const payload: InfographicRequest = {
        request: request.trim(),
        style: style as any,
        doc_type: docType === 'all' ? undefined : docType,
        width,
        height,
        output_format: 'visual',
      };

      const data = await generateInfographic(payload);
      setResult(data);

      if (data.error_message) {
        setError(data.error_message);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate infographic');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Create Infographic</h2>
            <p className="text-sm text-gray-500 mt-1">Generate a visual infographic from your documents</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Form */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  What do you want to visualize? *
                </label>
                <textarea
                  value={request}
                  onChange={(e) => setRequest(e.target.value)}
                  placeholder="e.g. Create an infographic showing Q1 mobile app strategy and key milestones"
                  className="w-full h-32 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-0 focus:border-gray-300 resize-none text-gray-900 placeholder:text-gray-400"
                  style={{ outline: 'none', boxShadow: 'none' }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Style *
                  </label>
                  <select
                    value={style}
                    onChange={(e) => setStyle(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-0 focus:border-gray-300"
                  >
                    {styles.length === 0 && <option value="">Loading...</option>}
                    {styles.map((s) => (
                      <option key={s.style} value={s.style}>
                        {s.style.charAt(0).toUpperCase() + s.style.slice(1)}
                      </option>
                    ))}
                  </select>
                  {styles.find((s) => s.style === style) && (
                    <p className="text-xs text-gray-500 mt-1">
                      {styles.find((s) => s.style === style)?.description}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Source Type
                  </label>
                  <select
                    value={docType}
                    onChange={(e) => setDocType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-0 focus:border-gray-300"
                  >
                    <option value="all">All Sources</option>
                    <option value="meeting">Meetings</option>
                    <option value="document">Documents</option>
                    <option value="email">Emails</option>
                    <option value="note">Notes</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Width (px)
                  </label>
                  <input
                    type="number"
                    value={width}
                    onChange={(e) => setWidth(parseInt(e.target.value) || 1024)}
                    min={512}
                    max={2048}
                    step={128}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-0 focus:border-gray-300"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Height (px)
                  </label>
                  <input
                    type="number"
                    value={height}
                    onChange={(e) => setHeight(parseInt(e.target.value) || 1024)}
                    min={512}
                    max={2048}
                    step={128}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-0 focus:border-gray-300"
                  />
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                  {error}
                </div>
              )}

              <button
                onClick={handleGenerate}
                disabled={isLoading || !request.trim() || !style}
                className="w-full px-4 py-3 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {isLoading ? 'Generating...' : 'Generate Infographic'}
              </button>
            </div>

            {/* Right: Preview/Result */}
            <div className="lg:border-l lg:pl-6">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center h-full min-h-[400px] space-y-4">
                  <div className="w-12 h-12 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
                  <p className="text-gray-600 text-sm">Generating infographic...</p>
                </div>
              ) : result ? (
                <div className="space-y-4">
                  {result.image ? (
                    <div className="rounded-lg overflow-hidden border border-gray-200">
                      <img
                        src={result.image.startsWith('data:') ? result.image : `data:image/png;base64,${result.image}`}
                        alt={result.structured_data.headline}
                        className="w-full h-auto"
                      />
                    </div>
                  ) : result.image_url ? (
                    <div className="rounded-lg overflow-hidden border border-gray-200">
                      <img
                        src={result.image_url}
                        alt={result.structured_data.headline}
                        className="w-full h-auto"
                        onError={async (e) => {
                          const target = e.target as HTMLImageElement;
                          // Try to regenerate URL if we have s3_key in metadata
                          if (result.metadata?.s3_key) {
                            try {
                              const response = await regenerateImageUrl(result.metadata.s3_key, 86400);
                              target.src = response.url;
                            } catch (err) {
                              console.error('Failed to regenerate URL:', err);
                              target.style.display = 'none';
                            }
                          } else {
                            target.style.display = 'none';
                          }
                        }}
                      />
                    </div>
                  ) : (
                    <div className="aspect-square flex flex-col items-center justify-center bg-gray-50 rounded-lg border border-gray-200 text-gray-400">
                      <svg className="w-16 h-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="text-sm">Image generation unavailable</p>
                    </div>
                  )}

                  {result.structured_data && (
                    <div className="space-y-3">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{result.structured_data.headline}</h3>
                        {result.structured_data.subtitle && (
                          <p className="text-sm text-gray-600">{result.structured_data.subtitle}</p>
                        )}
                      </div>

                      {result.structured_data.stats && result.structured_data.stats.length > 0 && (
                        <div className="grid grid-cols-2 gap-2">
                          {result.structured_data.stats.map((stat, i) => (
                            <div key={i} className="p-3 bg-gray-50 rounded-lg">
                              <div className="text-lg mb-1">{stat.icon || '📊'}</div>
                              <div className="text-sm font-semibold text-gray-900">{stat.value}</div>
                              <div className="text-xs text-gray-600">{stat.label}</div>
                            </div>
                          ))}
                        </div>
                      )}

                      {result.structured_data.key_points && result.structured_data.key_points.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 mb-2">Key Points</h4>
                          <ul className="space-y-1">
                            {result.structured_data.key_points.map((point, i) => (
                              <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[#FF8C00] flex-shrink-0" />
                                {point}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-gray-400">
                  <svg className="w-16 h-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm">Preview will appear here</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
