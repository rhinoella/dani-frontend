/**
 * API service for communicating with Dani-engine backend
 */

import { getStoredToken } from "@/contexts/AuthContext";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";

/**
 * Get authorization headers with current token
 * Now uses async to support token refresh
 */
async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await getStoredToken();
  if (token) {
    return {
      Authorization: `Bearer ${token}`,
    };
  }
  return {};
}

/**
 * Wrapper for fetch to handle network errors gracefully
 */
async function safeFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  try {
    const response = await fetch(input, init);
    return response;
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new ApiError(
        "Network error: Unable to reach the server. Please check your connection or try again later.",
        0,
        false
      );
    }
    throw error;
  }
}

export type MeetingCategory =
  | "board"
  | "1on1"
  | "standup"
  | "client"
  | "internal"
  | "external"
  | "all";

export interface ChatRequest {
  query: string;
  verbose?: boolean;
  stream?: boolean;
  output_format?: string;
  conversation_id?: string;
  include_history?: boolean;
  doc_type?: "meeting" | "email" | "document" | "note" | "all";
  meeting_category?: MeetingCategory; // Filter by meeting category
  document_ids?: string[]; // Specific documents to include in context
}

export interface Source {
  title: string | null;
  date: string | null;
  transcript_id: string | null;
  speakers: string[];
  text_preview: string;
  text?: string; // Backend may return 'text' instead of 'text_preview'
  relevance_score: number | null;
  meeting_category?: string | null; // Inferred meeting category
  category_confidence?: number | null; // Category inference confidence (0-1)
}

export interface ChatResponse {
  query: string;
  answer: string;
  sources: Source[];
  output_format: string | null;
  timings?: {
    retrieval_ms: number;
    generation_ms: number;
    total_ms: number;
  };
  error?: string;
}

export interface StreamChunk {
  type: "sources" | "token" | "answer" | "meta" | "timing" | "confidence" | "tool_call" | "tool_progress" | "tool_result" | "tool_error" | "rewrite";
  content?: Source[] | string | TimingData | ConfidenceData | RewriteData;
  conversation_id?: string;
  user_message_id?: string;  // Backend's real message ID for the user message
  disclaimer?: string;
  // Tool event fields (Phase 3)
  tool?: string;
  status?: string;
  args?: Record<string, unknown>;
  confidence?: number;
  message?: string;
  data?: ToolResultData;
  error?: string;
}

export interface RewriteData {
  original: string;
  rewritten: string;
}

// Tool result data structure
export interface ToolResultData {
  structured_data?: {
    headline: string;
    subtitle?: string;
    stats?: Array<{ value: string; label: string; icon?: string }>;
    key_points?: string[];
  };
  image?: string;
  content?: string;
  content_type?: string;
  sources?: Array<{ title: string; date?: string; score?: number }>;
  timing_ms?: number;
}

export interface ConfidenceData {
  level: "high" | "medium" | "low" | "none";
  avg_score: number;
  top_score: number;
  chunk_count: number;
  should_fallback: boolean;
}

export interface TimingData {
  retrieval_ms: number;
  prompt_ms: number;
  prompt_build_ms?: number;
  generation_ms: number;
  total_ms: number;
  chunks_used: number;
  tokens_generated: number;
}

/**
 * API Error class for handling HTTP errors
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public shouldReauth: boolean = false
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Handle API response errors
 */
async function handleResponse(response: Response): Promise<void> {
  if (!response.ok) {
    if (response.status === 401) {
      throw new ApiError("Authentication required", 401, true);
    }
    if (response.status === 403) {
      throw new ApiError(
        "Access denied - you may not be registered",
        403,
        false
      );
    }

    const errorText = await response.text();
    throw new ApiError(
      `Request failed: ${response.statusText} - ${errorText}`,
      response.status
    );
  }
}

/**
 * Send a chat message to the backend
 */
export async function sendChatMessage(
  query: string,
  stream = true,
  conversationId?: string,
  docType?: "meeting" | "email" | "document" | "note" | "all",
  meetingCategory?: MeetingCategory,
  documentIds?: string[]
): Promise<Response> {
  console.log("[API] sendChatMessage:", {
    query: query.slice(0, 50),
    stream,
    conversationId,
    docType,
    meetingCategory,
    documentIds,
  });
  const authHeaders = await getAuthHeaders();
  const requestBody = {
    query,
    stream,
    conversation_id: conversationId,
    include_history: true,
    doc_type: docType && docType !== "all" ? docType : undefined,
    meeting_category:
      meetingCategory && meetingCategory !== "all"
        ? meetingCategory
        : undefined,
    document_ids: documentIds && documentIds.length > 0 ? documentIds : undefined,
  } as ChatRequest;
  // console.log("[API] Request body:", requestBody);

  const response = await fetch(`${API_URL}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
    },
    body: JSON.stringify(requestBody),
  });

  console.log("[API] Response status:", response.status);
  await handleResponse(response);
  return response;
}


/**
 * Edit a specific message and regenerate response
 */
export async function editMessage(
  conversationId: string,
  messageId: string,
  newContent: string,
  stream = true
): Promise<Response> {
  console.log("[API] editMessage:", { conversationId, messageId, newContent, stream });
  const authHeaders = await getAuthHeaders();
  
  const requestBody = {
    query: newContent,
    stream,
    conversation_id: conversationId,
    include_history: true
  } as ChatRequest;

  const response = await fetch(`${API_URL}/chat/${conversationId}/messages/${messageId}/edit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
    },
    body: JSON.stringify(requestBody),
  });

  await handleResponse(response);
  return response;
}

/**
 * Parse Server-Sent Events stream from chat endpoint
 */
export async function* parseStreamResponse(
  response: Response
): AsyncGenerator<StreamChunk> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("No response body");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Parse SSE format: "data: {...}\n\n"
      const lines = buffer.split("\n\n");
      buffer = lines.pop() || ""; // Keep incomplete chunk in buffer

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const jsonStr = line.slice(6); // Remove "data: " prefix
          try {
            const chunk = JSON.parse(jsonStr) as StreamChunk;
            yield chunk;
          } catch {
            console.warn("Failed to parse chunk:", jsonStr);
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Send a non-streaming chat message and get complete response
 */
export async function sendChatMessageSync(
  query: string
): Promise<ChatResponse> {
  const response = await sendChatMessage(query, false);
  return response.json();
}

/**
 * Get current user info
 */
export async function getCurrentUser() {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_URL}/users/me`, {
    headers: authHeaders,
  });

  await handleResponse(response);
  return response.json();
}

/**
 * Update user profile
 */
export async function updateUserProfile(data: {
  name?: string;
  picture_url?: string;
}) {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_URL}/users/me`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
    },
    body: JSON.stringify(data),
  });

  await handleResponse(response);
  return response.json();
}


/**
 * Admin: List all users
 */
export async function adminListUsers(): Promise<Array<{
  id: string;
  name: string;
  email: string;
  picture_url?: string;
  created_at: string;
}>> {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_URL}/users/`, {
    headers: authHeaders,
  });

  await handleResponse(response);
  return response.json();
}

/**
 * Admin: Create user
 */
export async function adminCreateUser(data: { name: string; email: string }) {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_URL}/users/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
    },
    body: JSON.stringify(data),
  });

  await handleResponse(response);
  return response.json();
}

/**
 * Admin: Update user
 */
export async function adminUpdateUser(id: string, data: { name?: string; picture_url?: string }) {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_URL}/users/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
    },
    body: JSON.stringify(data),
  });

  await handleResponse(response);
  return response.json();
}

/**
 * Admin: Delete user
 */
export async function adminDeleteUser(id: string) {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_URL}/users/${id}`, {
    method: "DELETE",
    headers: authHeaders,
  });

  await handleResponse(response);
}

/**
 * Check API health
 */
export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

// ===== Conversation API =====

export interface ConversationSummary {
  id: string;
  user_id: string;
  title: string;
  summary: string | null;
  message_count: number;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface ConversationListResponse {
  conversations: ConversationSummary[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface MessageResponse {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  sources: Array<{
    title?: string | null;
    date?: string | null;
    transcript_id?: string | null;
    speakers?: string[];
    text_preview?: string;
    relevance_score?: number | null;
  }> | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface ConversationWithMessages {
  id: string;
  user_id: string;
  title: string;
  summary: string | null;
  message_count: number;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  messages: MessageResponse[];
}

/**
 * Get list of user's conversations
 */
export async function getConversations(
  page: number = 1,
  pageSize: number = 20
): Promise<ConversationListResponse> {
  console.log("[API] getConversations:", { page, pageSize });
  const authHeaders = await getAuthHeaders();
  const response = await safeFetch(
    `${API_URL}/conversations?page=${page}&page_size=${pageSize}`,
    {
      headers: authHeaders,
    }
  );

  await handleResponse(response);
  const data = await response.json();
  console.log("[API] getConversations response:", {
    total: data.total,
    count: data.conversations?.length,
  });
  return data;
}

/**
 * Get a conversation with its messages
 */
export async function getConversationWithMessages(
  conversationId: string,
  messageLimit: number = 50
): Promise<ConversationWithMessages> {
  console.log("[API] getConversationWithMessages:", {
    conversationId,
    messageLimit,
  });
  const authHeaders = await getAuthHeaders();
  const response = await fetch(
    `${API_URL}/conversations/${conversationId}/full?message_limit=${messageLimit}`,
    {
      headers: authHeaders,
    }
  );

  await handleResponse(response);
  const data = await response.json();
  console.log("[API] getConversationWithMessages response:", {
    id: data.id,
    title: data.title,
    messageCount: data.messages?.length,
  });
  return data;
}

/**
 * Delete a conversation
 */
export async function deleteConversation(
  conversationId: string
): Promise<void> {
  console.log("[API] deleteConversation:", conversationId);
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_URL}/conversations/${conversationId}`, {
    method: "DELETE",
    headers: authHeaders,
  });

  await handleResponse(response);
  console.log("[API] deleteConversation complete");
}

/**
 * Get frequently asked questions based on user history
 * Returns an array of questions that are most frequently asked
 */
export async function getFrequentQuestions(limit: number = 4): Promise<string[]> {
  console.log("[API] getFrequentQuestions:", { limit });
  try {
    const authHeaders = await getAuthHeaders();
    const response = await fetch(
      `${API_URL}/conversations/frequent-questions?limit=${limit}`,
      {
        headers: authHeaders,
      }
    );

    if (!response.ok) {
      console.log("[API] getFrequentQuestions failed, returning empty array");
      return [];
    }

    const data = await response.json();
    console.log("[API] getFrequentQuestions response:", data);
    return data.questions || [];
  } catch (error) {
    console.log("[API] getFrequentQuestions error:", error);
    return [];
  }
}

// ===== Document Upload API =====

export type DocumentType = "pdf" | "docx" | "txt";
export type DocumentStatus = "pending" | "processing" | "completed" | "failed";

export interface DocumentUploadResponse {
  id: string;
  filename: string;
  file_type: DocumentType;
  file_size: number;
  status: DocumentStatus;
  message: string;
}

export interface DocumentResponse {
  id: string;
  filename: string;
  file_type: DocumentType;
  file_size: number;
  file_size_mb: number;
  mime_type: string | null;
  title: string | null;
  description: string | null;
  status: DocumentStatus;
  error_message: string | null;
  chunk_count: number;
  total_tokens: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  processed_at: string | null;
  user_id: string | null;
}

export interface DocumentListResponse {
  documents: DocumentResponse[];
  total: number;
  skip: number;
  limit: number;
  has_more: boolean;
}

/**
 * Upload a document for processing
 */
export async function uploadDocument(
  file: File,
  title?: string,
  description?: string,
  onProgress?: (progress: number) => void
): Promise<DocumentUploadResponse> {
  console.log("[API] uploadDocument:", {
    filename: file.name,
    size: file.size,
    title,
  });

  const authHeaders = await getAuthHeaders();
  const formData = new FormData();
  formData.append("file", file);
  if (title) formData.append("title", title);
  if (description) formData.append("description", description);

  // Use XMLHttpRequest for progress tracking
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable && onProgress) {
        const progress = Math.round((event.loaded / event.total) * 100);
        onProgress(progress);
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          console.log("[API] uploadDocument success:", response);
          resolve(response);
        } catch (e) {
          reject(new ApiError("Failed to parse response", xhr.status));
        }
      } else if (xhr.status === 401) {
        reject(new ApiError("Authentication required", 401, true));
      } else if (xhr.status === 413) {
        reject(new ApiError("File too large (max 50MB)", 413));
      } else if (xhr.status === 415) {
        reject(
          new ApiError("Unsupported file type. Allowed: PDF, DOCX, TXT", 415)
        );
      } else {
        try {
          const error = JSON.parse(xhr.responseText);
          reject(new ApiError(error.detail || "Upload failed", xhr.status));
        } catch {
          reject(new ApiError(`Upload failed: ${xhr.statusText}`, xhr.status));
        }
      }
    });

    xhr.addEventListener("error", () => {
      reject(new ApiError("Network error during upload", 0));
    });

    xhr.addEventListener("abort", () => {
      reject(new ApiError("Upload cancelled", 0));
    });

    xhr.open("POST", `${API_URL}/documents/upload`);

    // Add auth header
    const token = authHeaders["Authorization"];
    if (token) {
      xhr.setRequestHeader("Authorization", token);
    }

    xhr.send(formData);
  });
}

/**
 * Get document status by ID
 */
export async function getDocumentStatus(
  documentId: string
): Promise<DocumentResponse> {
  const authHeaders = await getAuthHeaders();
  const response = await safeFetch(`${API_URL}/documents/${documentId}`, {
    method: "GET",
    headers: {
      ...authHeaders,
    },
  });
  await handleResponse(response);
  return response.json();
}

/**
 * Poll document status until it's completed or failed
 * Returns the final status
 */
export async function waitForDocumentReady(
  documentId: string,
  onStatusChange?: (status: DocumentStatus) => void,
  pollInterval = 4000, // 4 seconds to stay under 20/min rate limit
  maxWaitMs = 180000 // 3 minutes max
): Promise<DocumentResponse> {
  const startTime = Date.now();
  let currentInterval = pollInterval;
  
  while (Date.now() - startTime < maxWaitMs) {
    try {
      const doc = await getDocumentStatus(documentId);
      
      if (onStatusChange) {
        onStatusChange(doc.status);
      }
      
      if (doc.status === 'completed' || doc.status === 'failed') {
        return doc;
      }
      
      // Reset interval on successful request
      currentInterval = pollInterval;
      
    } catch (error) {
      // Handle rate limit by backing off
      if (error instanceof ApiError && error.status === 429) {
        console.warn('[API] Rate limited, backing off...');
        currentInterval = Math.min(currentInterval * 2, 30000); // Max 30s backoff
      } else {
        throw error;
      }
    }
    
    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, currentInterval));
  }
  
  throw new ApiError("Document processing timeout", 408);
}

/**
 * Get list of documents
 */
export async function listDocuments(
  skip: number = 0,
  limit: number = 20,
  status?: DocumentStatus,
  fileType?: DocumentType
): Promise<DocumentListResponse> {
  console.log("[API] listDocuments:", { skip, limit, status, fileType });
  const authHeaders = await getAuthHeaders();

  const params = new URLSearchParams();
  params.append("skip", skip.toString());
  params.append("limit", limit.toString());
  if (status) params.append("status", status);
  if (fileType) params.append("file_type", fileType);

  const response = await fetch(`${API_URL}/documents?${params.toString()}`, {
    headers: authHeaders,
  });

  await handleResponse(response);
  return response.json();
}

/**
 * Get a single document by ID
 */
export async function getDocument(
  documentId: string
): Promise<DocumentResponse> {
  console.log("[API] getDocument:", documentId);
  const authHeaders = await getAuthHeaders();

  const response = await fetch(`${API_URL}/documents/${documentId}`, {
    headers: authHeaders,
  });

  await handleResponse(response);
  return response.json();
}

/**
 * Delete a document
 */
export async function deleteDocument(
  documentId: string
): Promise<{
  id: string;
  deleted: boolean;
  chunks_removed: number;
  message: string;
}> {
  console.log("[API] deleteDocument:", documentId);
  const authHeaders = await getAuthHeaders();

  const response = await fetch(`${API_URL}/documents/${documentId}`, {
    method: "DELETE",
    headers: authHeaders,
  });

  await handleResponse(response);
  return response.json();
}

/**
 * Get presigned download URL for a document
 */
export interface DocumentDownloadUrlResponse {
  id: string;
  filename: string;
  download_url: string;
  expires_in_seconds: number;
}

export async function getDocumentDownloadUrl(
  documentId: string,
  expiresIn: number = 3600
): Promise<DocumentDownloadUrlResponse> {
  console.log("[API] getDocumentDownloadUrl:", { documentId, expiresIn });
  const authHeaders = await getAuthHeaders();

  const response = await fetch(
    `${API_URL}/documents/${documentId}/download-url?expires_in=${expiresIn}`,
    {
      headers: authHeaders,
    }
  );

  await handleResponse(response);
  return response.json();
}

// ============== Ghostwriter API ==============

export type DocTypeFilter = "meeting" | "email" | "document" | "note" | "all";
export type ContentTypeValue =
  | "linkedin_post"
  | "email"
  | "blog_draft"
  | "tweet_thread"
  | "newsletter"
  | "meeting_summary";
export type ToneValue = "formal" | "casual" | "urgent" | "inspirational";

export interface ContentType {
  type: ContentTypeValue;
  description: string;
}

export interface GhostwriteRequest {
  content_type: ContentTypeValue;
  request: string;
  topic?: string;
  doc_type?: DocTypeFilter;
  additional_context?: string;
  tone?: ToneValue;
  max_length?: number;
}

export interface GhostwriteSource {
  title: string;
  date: number;
  transcript_id: string;
  relevance_score: number;
}

export interface GhostwriteResponse {
  content: string;
  content_type: string;
  word_count: number;
  sources: GhostwriteSource[];
  confidence: {
    level: string;
    metrics: Record<string, unknown>;
  };
  timing: {
    retrieval_ms: number;
    generation_ms: number;
    total_ms: number;
  };
  metadata: {
    topic: string;
    doc_type_filter: string | null;
    tone: string | null;
    chunks_used: number;
  };
}

export interface RefineRequest {
  content: string;
  feedback: string;
  content_type: string;
}

export interface RefineResponse {
  content: string;
  content_type: string;
  word_count: number;
  timing: { total_ms: number };
  refined_from: string;
  feedback_applied: string;
}

/**
 * Get available content types for Ghostwriter
 */
export async function getContentTypes(): Promise<ContentType[]> {
  console.log("[API] getContentTypes");
  const authHeaders = await getAuthHeaders();

  const response = await fetch(`${API_URL}/ghostwriter/types`, {
    headers: authHeaders,
  });

  await handleResponse(response);
  return response.json();
}

/**
 * Generate content using Ghostwriter
 */
export async function generateContent(
  request: GhostwriteRequest
): Promise<GhostwriteResponse> {
  console.log("[API] generateContent:", request);
  const authHeaders = await getAuthHeaders();

  const response = await fetch(`${API_URL}/ghostwriter/generate`, {
    method: "POST",
    headers: {
      ...authHeaders,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  await handleResponse(response);
  return response.json();
}

/**
 * Refine previously generated content
 */
export async function refineContent(request: RefineRequest): Promise<RefineResponse> {
  console.log('[API] refineContent:', request);
  const authHeaders = await getAuthHeaders();
  
  const response = await fetch(`${API_URL}/ghostwriter/refine`, {
    method: 'POST',
    headers: {
      ...authHeaders,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  await handleResponse(response);
  return response.json();
}

// ============== Infographic API ==============

export type InfographicStyle =
  | "modern"
  | "corporate"
  | "minimal"
  | "vibrant"
  | "dark";
export type OutputFormat = "visual" | "schema" | "both";

export interface InfographicStat {
  value: string;
  label: string;
  icon?: string;
}

export interface StructuredData {
  headline: string;
  subtitle?: string;
  stats: InfographicStat[];
  key_points?: string[];
  source_summary?: string;
}

export interface InfographicRequest {
  request: string;
  topic?: string;
  style?: InfographicStyle;
  doc_type?: DocTypeFilter;
  width?: number;
  height?: number;
  output_format?: OutputFormat;
}

export interface InfographicResponse {
  id: string | null;
  structured_data: StructuredData;
  image?: string; // Base64
  image_url?: string; // S3 URL
  sources: any[];
  confidence: any;
  metadata: any;
  error_message?: string;
}

export interface InfographicListItem {
  id: string;
  headline?: string;
  style?: string;
  status: string;
  image_url?: string;
  created_at?: string;
}

/**
 * Get available infographic styles
 */
export async function getInfographicStyles(): Promise<
  { style: string; description: string }[]
> {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_URL}/infographic/styles`, {
    headers: authHeaders,
  });
  await handleResponse(response);
  return response.json();
}

/**
 * Generate an infographic
 */
export async function generateInfographic(
  request: InfographicRequest
): Promise<InfographicResponse> {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_URL}/infographic/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
    },
    body: JSON.stringify(request),
  });
  await handleResponse(response);
  return response.json();
}

/**
 * List infographics
 */
export async function listInfographics(
  limit = 20,
  offset = 0
): Promise<{ items: InfographicListItem[] }> {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(
    `${API_URL}/infographic/?limit=${limit}&offset=${offset}`,
    {
      headers: authHeaders,
    }
  );
  await handleResponse(response);
  return response.json();
}

/**
 * Get single infographic
 */
export async function getInfographic(id: string): Promise<InfographicResponse> {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_URL}/infographic/${id}`, {
    headers: authHeaders,
  });
  await handleResponse(response);
  return response.json();
}

/**
 * Get download URL
 */
export async function getInfographicDownloadUrl(id: string): Promise<string> {
  const authHeaders = await getAuthHeaders();
  // Note: Backend endpoint redirects to S3 URL, so we might follow it or just return the endpoint URL
  // if the frontend handles the redirect.
  // Actually, the backend /download endpoint returns a redirect.
  // To get the URL without following it immediately, we might need a different approach or
  // just let the browser handle the link.

  // Alternative: The backend logic for /download returns RedirectResponse.
  // If we fetch it, we get the image content or the redirect.

  // Let's assume we use the direct link in an <a> tag pointing to the backend which redirects.
  return `${API_URL}/infographic/${id}/download`;
}
