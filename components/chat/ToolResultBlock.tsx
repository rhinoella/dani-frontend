"use client";

import React from "react";
import { CopyIcon, ChevronDownIcon } from "@/components/ui/Icons";
import { ToolResultData, regenerateImageUrl } from "@/services/api";

type ToolName = "infographic_generator" | "content_writer";

interface ToolResultBlockProps {
  toolName: ToolName;
  data: ToolResultData;
}

/**
 * Extract S3 key from an S3 presigned URL
 * URL format: https://bucket.s3.region.amazonaws.com/key?signature_params
 */
function extractS3KeyFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    // S3 URLs: bucket.s3.region.amazonaws.com/key or s3.region.amazonaws.com/bucket/key
    const pathname = urlObj.pathname;
    // Remove leading slash
    const key = pathname.startsWith('/') ? pathname.substring(1) : pathname;
    if (key) {
      console.log('[ToolResultBlock] Extracted S3 key from URL:', key);
      return key;
    }
  } catch (e) {
    console.error('[ToolResultBlock] Failed to extract S3 key from URL:', e);
  }
  return null;
}

// Infographic Image component with fallback handling and URL regeneration
function InfographicImage({ 
  imageUrl, 
  imageBase64, 
  s3Key 
}: { 
  imageUrl?: string; 
  imageBase64?: string;
  s3Key?: string;
}) {
  const [currentUrl, setCurrentUrl] = React.useState<string | null>(imageUrl || null);
  const [useBase64, setUseBase64] = React.useState(false);
  const [imageError, setImageError] = React.useState(false);
  const [isRegenerating, setIsRegenerating] = React.useState(false);
  const hasTriedRegeneration = React.useRef(false);
  
  // Try to get S3 key from the URL if not provided directly
  const effectiveS3Key = React.useMemo(() => {
    if (s3Key) return s3Key;
    if (imageUrl) return extractS3KeyFromUrl(imageUrl);
    return null;
  }, [s3Key, imageUrl]);

  // Build the src URL
  const base64Src = imageBase64 
    ? (imageBase64.startsWith("data:") ? imageBase64 : `data:image/png;base64,${imageBase64}`)
    : null;
  
  // Try URL first, fallback to base64
  const src = useBase64 ? base64Src : (currentUrl || base64Src);

  // Function to try regenerating the URL
  const tryRegenerateUrl = React.useCallback(async () => {
    if (!effectiveS3Key || hasTriedRegeneration.current || isRegenerating) return;
    
    hasTriedRegeneration.current = true;
    setIsRegenerating(true);
    
    try {
      console.log('[ToolResultBlock] Attempting to regenerate URL from S3 key:', effectiveS3Key);
      const newUrl = await regenerateImageUrl(effectiveS3Key);
      console.log('[ToolResultBlock] Successfully regenerated URL:', newUrl);
      setCurrentUrl(newUrl);
      setUseBase64(false);
      setImageError(false);
    } catch (error) {
      console.error('[ToolResultBlock] Failed to regenerate URL:', error);
      // Fall through to base64 or show error
      if (base64Src) {
        setUseBase64(true);
      } else {
        setImageError(true);
      }
    } finally {
      setIsRegenerating(false);
    }
  }, [effectiveS3Key, base64Src, isRegenerating]);

  // On mount: if we have s3_key but no imageUrl or base64, try to regenerate immediately
  React.useEffect(() => {
    if (!currentUrl && !base64Src && effectiveS3Key && !hasTriedRegeneration.current) {
      console.log('[ToolResultBlock] No image URL or base64, attempting to regenerate from s3_key');
      tryRegenerateUrl();
    }
  }, [currentUrl, base64Src, effectiveS3Key, tryRegenerateUrl]);

  if (isRegenerating) {
    return (
      <div className="flex items-center justify-center h-48 text-[var(--foreground-muted)]">
        <div className="flex flex-col items-center gap-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]"></div>
          <span>Loading image...</span>
        </div>
      </div>
    );
  }

  if (imageError && !base64Src) {
    // Both URL and base64 failed
    return (
      <div className="flex flex-col items-center justify-center h-48 text-[var(--foreground-muted)] gap-2">
        <span>Image unavailable</span>
        {effectiveS3Key && (
          <button 
            onClick={() => {
              hasTriedRegeneration.current = false;
              setImageError(false);
              tryRegenerateUrl();
            }}
            className="text-sm text-[var(--primary)] hover:underline"
          >
            Try again
          </button>
        )}
      </div>
    );
  }

  // If we have no source at all, show placeholder
  if (!src) {
    return (
      <div className="flex items-center justify-center h-48 text-[var(--foreground-muted)]">
        <span>No image available</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt="Generated Infographic"
      className="w-full h-auto object-contain max-h-[500px]"
      onError={() => {
        console.log('[ToolResultBlock] Image load error. useBase64:', useBase64, 'hasS3Key:', !!effectiveS3Key, 'hasTriedRegeneration:', hasTriedRegeneration.current);
        
        if (!useBase64) {
          // URL failed - try base64 fallback first (CSP may be blocking external URLs)
          if (base64Src) {
            console.log('[ToolResultBlock] Image URL failed (possibly CSP), falling back to base64');
            setUseBase64(true);
            return;
          }
          
          // No base64 available - try regeneration ONCE if we have s3_key and haven't tried yet
          if (effectiveS3Key && !hasTriedRegeneration.current) {
            tryRegenerateUrl();
            return;
          }
        }
        
        // Both failed
        setImageError(true);
      }}
    />
  );
}

// Download icon SVG
const DownloadIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

// Chevron up icon
const ChevronUpIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
  </svg>
);

// Check icon
const CheckIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

/**
 * ToolResultBlock - Displays the result of a tool execution
 * 
 * For infographic_generator: Shows structured data + image
 * For content_writer: Shows formatted content
 */
export function ToolResultBlock({ toolName, data }: ToolResultBlockProps) {
  const [isExpanded, setIsExpanded] = React.useState(true);
  const [copied, setCopied] = React.useState(false);

  // Debug logging
  React.useEffect(() => {
    console.log('[ToolResultBlock] Rendering with:', {
      toolName,
      hasStructuredData: !!data?.structured_data,
      hasImage: !!data?.image,
      hasImageUrl: !!data?.image_url,
      hasS3Key: !!data?.s3_key,
      s3Key: data?.s3_key,
      imageUrlPreview: data?.image_url?.substring(0, 100),
    });
  }, [toolName, data]);

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Render infographic result
  if (toolName === "infographic_generator" && data.structured_data) {
    const { headline, subtitle, stats, key_points } = data.structured_data;

    return (
      <div className="my-3 rounded-lg border border-[var(--glass-border)] bg-[var(--surface)] overflow-hidden transition-all duration-200">
        {/* Header */}
        <div 
          className="p-4 cursor-pointer flex items-center justify-between hover:bg-[var(--surface-hover)] transition-colors border-b border-transparent hover:border-[var(--glass-border)]"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div>
            <h3 className="text-lg font-bold text-[var(--foreground)]">
              {headline}
            </h3>
            {subtitle && (
              <p className="text-sm text-[var(--foreground-muted)] mt-1">
                {subtitle}
              </p>
            )}
          </div>
          {isExpanded ? (
            <ChevronUpIcon className="w-5 h-5 text-[var(--foreground-muted)]" />
          ) : (
            <ChevronDownIcon className="w-5 h-5 text-[var(--foreground-muted)]" />
          )}
        </div>

        {/* Expandable content */}
        {isExpanded && (
          <div className="pb-4">
             {/* Image (Moved to top, full width) */}
            {(data.image || data.image_url || data.s3_key) && (
              <div className="relative group border-b border-[var(--glass-border)] mb-4 bg-black/5">
                <InfographicImage 
                  imageUrl={data.image_url} 
                  imageBase64={data.image} 
                  s3Key={data.s3_key}
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    // Prefer base64 for download as it's more reliable
                    const imageSrc = data.image 
                      ? (data.image.startsWith("data:") ? data.image : `data:image/png;base64,${data.image}`)
                      : data.image_url || '';
                    if (imageSrc) {
                      const link = document.createElement("a");
                      link.href = imageSrc;
                      link.download = "infographic.png";
                      link.click();
                    }
                  }}
                  className="absolute top-2 right-2 p-2 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70 backdrop-blur-sm"
                  title="Download Image"
                >
                  <DownloadIcon className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="px-4 space-y-4">
              {/* Stats Grid */}
              {stats && stats.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {stats.map((stat, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg bg-[var(--surface-hover)] border border-[var(--glass-border)]"
                    >
                      <div className="text-2xl mb-1">{stat.icon || "📊"}</div>
                      <div className="text-xl font-bold text-[var(--foreground)]">
                        {stat.value}
                      </div>
                      <div className="text-xs text-[var(--foreground-muted)]">
                        {stat.label}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Key Points */}
              {key_points && key_points.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-[var(--foreground)]">
                    Key Insights
                  </h4>
                  <ul className="space-y-2">
                    {key_points.map((point, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-2 text-sm text-[var(--foreground-secondary)]"
                      >
                        <span className="text-[var(--primary)] mt-1.5 w-1.5 h-1.5 rounded-full bg-[var(--primary)] flex-shrink-0" />
                        <span className="leading-relaxed">
                          {point.split(/(\*\*.*?\*\*)/).map((part, i) => 
                            part.startsWith('**') && part.endsWith('**') ? (
                              <strong key={i} className="font-semibold text-[var(--foreground)]">
                                {part.slice(2, -2)}
                              </strong>
                            ) : (
                              <span key={i}>{part}</span>
                            )
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Timing */}
              {data.timing_ms && (
                <p className="text-xs text-[var(--foreground-muted)] pt-2 border-t border-[var(--glass-border)]">
                  Generated in {(data.timing_ms / 1000).toFixed(1)}s
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Render content writer result
  if (toolName === "content_writer" && data.content) {
    return (
      <div className="my-3 rounded-lg border border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/30 overflow-hidden">
        {/* Header */}
        <div className="p-3 border-b border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
          <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
            {data.content_type === "linkedin_post" ? "LinkedIn Post" :
             data.content_type === "email" ? "Email Draft" :
             data.content_type === "tweet_thread" ? "Tweet Thread" :
             "Generated Content"}
          </span>
          <button
            onClick={() => handleCopy(data.content!)}
            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-800/50 transition-colors"
          >
            {copied ? (
              <>
                <CheckIcon className="w-3 h-3" />
                Copied!
              </>
            ) : (
              <>
                <CopyIcon className="w-3 h-3" />
                Copy
              </>
            )}
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
            {data.content}
          </div>
        </div>

        {/* Timing */}
        {data.timing_ms && (
          <div className="px-4 pb-3">
            <p className="text-xs text-gray-500 dark:text-gray-500">
              Generated in {(data.timing_ms / 1000).toFixed(1)}s
            </p>
          </div>
        )}
      </div>
    );
  }

  // Fallback for unknown tool results
  return (
    <div className="my-3 p-4 rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
      <pre className="text-xs overflow-auto">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

export default ToolResultBlock;
