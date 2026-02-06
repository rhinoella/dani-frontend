'use client';

import { useState, useEffect, useCallback } from 'react';
import { listInfographics, deleteInfographic, getInfographicDownloadUrl, regenerateImageUrl, InfographicListItem } from '@/services/api';

export default function InfographicsView() {
  const [infographics, setInfographics] = useState<InfographicListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | 'all'>('all');
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const fetchInfographics = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await listInfographics(
        limit,
        offset,
        statusFilter !== 'all' ? statusFilter : undefined
      );
      setInfographics(response.items);
      setTotal(response.total);
    } catch (err) {
      setError('Failed to load infographics');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [offset, statusFilter]);

  useEffect(() => {
    fetchInfographics();
  }, [fetchInfographics]);

  const handleDelete = async (infographicId: string) => {
    if (!confirm('Are you sure you want to delete this infographic?')) return;
    try {
      await deleteInfographic(infographicId);
      await fetchInfographics();
    } catch (err) {
      setError('Failed to delete infographic');
      console.error(err);
    }
  };

  const handleDownload = async (infographicId: string) => {
    const url = await getInfographicDownloadUrl(infographicId);
    window.open(url, '_blank');
  };

  const [regeneratingUrls, setRegeneratingUrls] = useState<Set<string>>(new Set());
  const [regeneratedUrls, setRegeneratedUrls] = useState<Map<string, string>>(new Map());
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  const handleImageError = async (infographic: InfographicListItem, e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    
    // If we already have a regenerated URL, don't try again
    if (regeneratedUrls.has(infographic.id)) {
      setFailedImages(prev => new Set(prev).add(infographic.id));
      return;
    }

    // If we're already regenerating, don't try again
    if (regeneratingUrls.has(infographic.id)) {
      return;
    }

    // If we have an S3 key, try to regenerate the URL
    if (infographic.s3_key) {
      setRegeneratingUrls(prev => new Set(prev).add(infographic.id));
      try {
        const response = await regenerateImageUrl(infographic.s3_key, 86400);
        setRegeneratedUrls(prev => new Map(prev).set(infographic.id, response.url));
        img.src = response.url;
      } catch (err) {
        console.error('Failed to regenerate URL:', err);
        setFailedImages(prev => new Set(prev).add(infographic.id));
      } finally {
        setRegeneratingUrls(prev => {
          const next = new Set(prev);
          next.delete(infographic.id);
          return next;
        });
      }
    } else {
      // No S3 key available - mark as failed
      setFailedImages(prev => new Set(prev).add(infographic.id));
    }
  };

  const formatDate = (dateString: string | undefined): string => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
    if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
    if (diffDays < 7) return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      completed: 'bg-green-100 text-green-700 border-green-200',
      processing: 'bg-blue-100 text-blue-700 border-blue-200',
      failed: 'bg-red-100 text-red-700 border-red-200',
      pending: 'bg-gray-100 text-gray-700 border-gray-200',
    };
    return styles[status] || styles.pending;
  };

  // Filter infographics based on search
  const filteredInfographics = infographics.filter((infographic) =>
    (infographic.headline || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const hasMore = offset + limit < total;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">
      {/* Header */}
      <div className="px-8 py-6 border-b border-gray-200">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Infographics</h1>
          </div>

          {/* Search Bar */}
          <div className="relative mb-4">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setOffset(0);
              }}
              placeholder="Search infographics..."
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0 focus:border-gray-300 transition-all"
              style={{ outline: 'none', boxShadow: 'none' }}
            />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3 mb-4">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setOffset(0);
              }}
              className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-0 focus:border-gray-300"
            >
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="processing">Processing</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          {/* Infographic Count */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              {total} {total === 1 ? 'infographic' : 'infographics'}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-8 py-4">
        <div className="max-w-4xl mx-auto">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-600 text-sm">Loading infographics...</p>
            </div>
          ) : filteredInfographics.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-gray-500 text-sm">
                {searchQuery || statusFilter !== 'all'
                  ? 'No infographics found matching your filters'
                  : 'No infographics yet'}
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredInfographics.map((infographic) => (
                  <div
                    key={infographic.id}
                    className="group relative bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-all"
                  >
                    {/* Image Preview */}
                    {failedImages.has(infographic.id) ? (
                      <div className="aspect-video bg-gray-100 flex flex-col items-center justify-center text-gray-400">
                        <svg className="w-12 h-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p className="text-xs mb-2">Image unavailable</p>
                        <button
                          onClick={() => handleDownload(infographic.id)}
                          className="px-3 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded text-gray-700 transition-colors"
                        >
                          Download
                        </button>
                      </div>
                    ) : (infographic.image_url || regeneratedUrls.get(infographic.id)) ? (
                      <div className="aspect-video bg-gray-100 relative overflow-hidden">
                        <img
                          src={regeneratedUrls.get(infographic.id) || infographic.image_url}
                          alt={infographic.headline || 'Infographic'}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => handleImageError(infographic, e)}
                          onLoad={() => {
                            // Clear any error state if image loads successfully
                            setRegeneratingUrls(prev => {
                              const next = new Set(prev);
                              next.delete(infographic.id);
                              return next;
                            });
                            setFailedImages(prev => {
                              const next = new Set(prev);
                              next.delete(infographic.id);
                              return next;
                            });
                          }}
                        />
                        {regeneratingUrls.has(infographic.id) && (
                          <div className="absolute inset-0 bg-gray-100/80 flex items-center justify-center">
                            <div className="w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="aspect-video bg-gray-100 flex items-center justify-center">
                        <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}

                    {/* Content */}
                    <div className="p-4">
                      <h3 className="text-sm font-semibold text-gray-900 truncate mb-1 group-hover:text-[#FF8C00] transition-colors">
                        {infographic.headline || 'Untitled Infographic'}
                      </h3>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-2">
                          {infographic.style && (
                            <span className="text-xs text-gray-500 capitalize">{infographic.style}</span>
                          )}
                          <span className={`px-2 py-0.5 rounded-full border text-xs ${getStatusBadge(infographic.status)}`}>
                            {infographic.status}
                          </span>
                        </div>
                        <span className="text-xs text-gray-400">
                          {formatDate(infographic.created_at)}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="absolute top-2 right-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleDownload(infographic.id)}
                        className="p-2 bg-white/90 backdrop-blur-sm rounded-lg shadow-sm hover:bg-white transition-colors"
                        title="Download"
                      >
                        <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(infographic.id)}
                        className="p-2 bg-white/90 backdrop-blur-sm rounded-lg shadow-sm hover:bg-red-50 transition-colors"
                        title="Delete"
                      >
                        <svg className="w-4 h-4 text-gray-600 hover:text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {(hasMore || offset > 0) && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => setOffset(Math.max(0, offset - limit))}
                    disabled={offset === 0}
                    className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-600">
                    Showing {offset + 1}-{Math.min(offset + limit, total)} of {total}
                  </span>
                  <button
                    onClick={() => setOffset(offset + limit)}
                    disabled={!hasMore}
                    className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
