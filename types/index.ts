// Meeting category types for filtering
export type MeetingCategory = 
  | "board" 
  | "1on1" 
  | "standup" 
  | "client" 
  | "internal" 
  | "external" 
  | "all";

export interface User {
  id: string;
  name: string;
  avatar?: string;
}

// Authenticated user from backend
export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  picture_url: string | null;
  created_at: string | null;
  last_login_at: string | null;
}

// Source reference from RAG
export interface MessageSource {
  title?: string;
  date?: string | number;  // Can be Unix timestamp (ms) or formatted string
  transcript_id?: string;
  speakers?: string[];
  text_preview?: string;
  text?: string;  // Backend may return 'text' instead of 'text_preview'
  relevance_score?: number;
  meeting_category?: string | null;      // Inferred meeting category
  category_confidence?: number | null;   // Category inference confidence (0-1)
}

// Confidence scoring from RAG
export interface ConfidenceData {
  level: 'high' | 'medium' | 'low' | 'none';
  avg_score: number;
  top_score: number;
  chunk_count: number;
  should_fallback: boolean;
}

// Timing data from backend
export interface MessageTimings {
  retrieval_ms?: number;
  generation_ms?: number;
  total_ms?: number;
  prompt_build_ms?: number;
}

export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  timestamp: Date;
  userId?: string;
  sources?: MessageSource[];  // Sources used for this specific message
  confidence?: ConfidenceData;  // Confidence scoring
  disclaimer?: string;  // Low confidence warning
  timings?: MessageTimings;  // Performance timing
  toolResult?: ToolResultEvent['data']; // Tool execution result
  toolName?: ToolName; // Name of the tool used
  attachments?: {
    id: string;
    name: string;
    type: 'pdf' | 'docx' | 'txt' | 'other';
    size?: number;
  }[];
  // Edit history: stores previous input/response pairs for version navigation
  pairedHistory?: {
    userContent: string;
    assistantContent: string;
  }[];
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  activeAttachments?: {
    id: string;
    name: string;
    type: 'pdf' | 'docx' | 'txt' | 'other';
    size?: number;
  }[];
}

export interface ChatInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export interface ChatMessageProps {
  message: Message;
  isLoading?: boolean;
}

export interface SidebarProps {
  conversations: Conversation[];
  currentConversationId: string;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
}

export interface Source {
  title: string | null;
  date: string | number | null;  // Can be Unix timestamp (ms) or formatted string
  transcript_id: string | null;
  speakers: string[];
  text_preview: string;
  text?: string;  // Backend may return 'text' instead of 'text_preview'
  relevance_score: number | null;
  meeting_category?: string | null;      // Inferred meeting category
  category_confidence?: number | null;   // Category inference confidence (0-1)
}

// ============================================
// Tool/Agent Event Types (Phase 3)
// ============================================

export type ToolName = 'infographic_generator' | 'content_writer';

export interface ToolCallEvent {
  type: 'tool_call';
  tool: ToolName;
  status: 'starting';
  args: Record<string, unknown>;
  confidence: number;
}

export interface ToolProgressEvent {
  type: 'tool_progress';
  tool: ToolName;
  status: 'processing';
  message: string;
}

export interface ToolResultEvent {
  type: 'tool_result';
  tool: ToolName;
  status: 'complete';
  data: {
    // Infographic result
    structured_data?: {
      headline: string;
      subtitle?: string;
      stats?: Array<{ value: string; label: string; icon?: string }>;
      key_points?: string[];
    };
    image?: string;  // Base64 or URL
    // Content writer result
    content?: string;
    content_type?: string;
    // Common
    sources?: Array<{ title: string; date?: string; score?: number }>;
    timing_ms?: number;
  };
}

export interface ToolErrorEvent {
  type: 'tool_error';
  tool: ToolName;
  error: string;
}

export type ToolEvent = ToolCallEvent | ToolProgressEvent | ToolResultEvent | ToolErrorEvent;

// Extended Message type to include tool data
export interface ToolMessage extends Omit<Message, 'content'> {
  role: 'tool';
  toolName: ToolName;
  toolStatus: 'starting' | 'processing' | 'complete' | 'error';
  toolResult?: ToolResultEvent['data'];
  toolError?: string;
  content: string;  // Summary message for display
}
