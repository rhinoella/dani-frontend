"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ChatLayout from "@/components/layouts/ChatLayout";
import ChatMessage from "@/components/chat/ChatMessage";
import ChatInput from "@/components/chat/ChatInput";
import HomeView from "@/components/home/HomeView";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import ToolCallBlock from "@/components/chat/ToolCallBlock";
import ToolResultBlock from "@/components/chat/ToolResultBlock";
import { Alert } from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import {
  Message,
  Conversation,
  Source,
  MessageSource,
  ConfidenceData,
  MessageTimings,
  MeetingCategory,
  ToolMessage,
} from "@/types";
import {
  sendChatMessage,
  parseStreamResponse,
  ApiError,
  getConversations,
  getConversationWithMessages,
  deleteConversation as apiDeleteConversation,
  editMessage,
  TimingData,
  ConfidenceData as ApiConfidenceData,
  ToolResultData,
} from "@/services/api";
import { generateUUID } from "@/utils/uuid";
import { useAuth } from "@/contexts/AuthContext";

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] =
    useState<string>("new");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [streamingContent, setStreamingContent] = useState<string>("");
  const [sources, setSources] = useState<Source[]>([]);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(
    null
  );
  const [docType, setDocType] = useState<'meeting' | 'email' | 'document' | 'note' | 'all'>('all');
  const [meetingCategory, setMeetingCategory] = useState<MeetingCategory>('all');
  const [pendingConversationId, setPendingConversationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Tool state for agentic workflow (Phase 3)
  const [toolState, setToolState] = useState<{
    isActive: boolean;
    toolName?: string;
    status?: 'starting' | 'processing' | 'complete' | 'error';
    message?: string;
    args?: Record<string, unknown>;
    result?: ToolResultData;
    error?: string;
  }>({ isActive: false });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signOut, isAuthenticated, isLoading: isAuthLoading } = useAuth();

  // Load conversations from backend on mount (only when authenticated)
  useEffect(() => {
    // Wait for auth to finish loading and confirm user is authenticated
    if (isAuthLoading || !isAuthenticated) {
      if (!isAuthLoading && !isAuthenticated) {
        setIsLoadingHistory(false);
      }
      return;
    }

    const loadConversations = async () => {
      console.log("[Chat] Loading conversations from backend...");
      try {
        setIsLoadingHistory(true);
        setError(null);
        const response = await getConversations(1, 50);

        console.log("[Chat] Loaded conversations from API:", {
          total: response.total,
          page: response.page,
          conversations: response.conversations.map((c) => ({
            id: c.id,
            title: c.title,
            message_count: c.message_count,
          })),
        });

        // Convert backend response to frontend Conversation type
        const loadedConversations: Conversation[] = response.conversations.map(
          (conv) => ({
            id: conv.id,
            title: conv.title || "Untitled",
            messages: [], // Messages will be loaded when conversation is selected
            createdAt: new Date(conv.created_at),
            updatedAt: new Date(conv.updated_at),
          })
        );

        setConversations(loadedConversations);
        console.log(
          "[Chat] Conversations state updated:",
          loadedConversations.length,
          "conversations"
        );
      } catch (error) {
        console.error("[Chat] Failed to load conversations:", error);
        // On auth error, redirect to login
        if (error instanceof ApiError && error.shouldReauth) {
          console.log("[Chat] Auth error, redirecting to login");
          signOut();
          router.push("/");
        }
      } finally {
        setIsLoadingHistory(false);
      }
    };

    loadConversations();
  }, [signOut, router, isAuthLoading, isAuthenticated]);

  const handleRetryLoad = () => {
     // Re-trigger the effect by forcing a re-mount or just extracting load function?
     // Easiest is to reload page or just call a refreshing function.
     // To keep it simple and clean, let's extract load logic or just reload the window for now, 
     // BUT better to just call the load function.
     // Refactoring creation of loadConversations to be outside useEffect is cleaner but let's do a simple reload for now 
     // OR better: we can make a state trigger.
     window.location.reload(); 
  };

  // Handle URL-based conversation selection (for navigation from other pages like Ghostwriter)
  useEffect(() => {
    const conversationParam = searchParams.get('conversation');
    if (conversationParam && conversationParam !== 'new') {
      setPendingConversationId(conversationParam);
    }
  }, [searchParams]);

  // Select pending conversation once conversations are loaded
  useEffect(() => {
    if (pendingConversationId && conversations.length > 0 && !isLoadingHistory) {
      const convExists = conversations.some(c => c.id === pendingConversationId);
      if (convExists) {
        // We need to call the selection logic - but handleSelectConversation is defined after
        // So we just set the ID and let the existing flow handle it
        setCurrentConversationId(pendingConversationId);
        // Load messages for this conversation
        getConversationWithMessages(pendingConversationId).then(response => {
          const messages: Message[] = response.messages.map((m) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            content: m.content,
            timestamp: new Date(m.created_at),
            // Map tool result data from metadata
            toolResult: (m.metadata?.tool_result as any),
            toolName: (m.metadata?.tool_name as any),
            // Map paired history for version navigation
            pairedHistory: (m.metadata?.paired_history as any),
            sources: (m.sources || []).map((s) => ({
              title: s.title || "Untitled",
              content: s.text_preview || "",
              score: s.relevance_score || 0,
            })),
          }));
          setConversations(prev => prev.map(c => 
            c.id === pendingConversationId ? { ...c, messages } : c
          ));
        }).catch(err => {
          console.error('[Chat] Failed to load conversation messages:', err);
        });
        setPendingConversationId(null);
        // Clear the URL param
        router.replace('/chat', { scroll: false });
      }
    }
  }, [pendingConversationId, conversations, isLoadingHistory, router]);

  // Load messages when a conversation is selected
  const handleSelectConversation = useCallback(
    async (conversationId: string) => {
      console.log("[Chat] handleSelectConversation called:", conversationId);

      if (conversationId === "new") {
        console.log("[Chat] Starting new conversation");
        setCurrentConversationId("new");
        return;
      }

      // Check if messages are already loaded
      const existingConv = conversations.find((c) => c.id === conversationId);
      console.log(
        "[Chat] Existing conversation found:",
        existingConv
          ? { id: existingConv.id, messageCount: existingConv.messages.length }
          : "none"
      );

      if (existingConv && existingConv.messages.length > 0) {
        console.log("[Chat] Messages already loaded, using cached");
        setCurrentConversationId(conversationId);
        // Show sources from last assistant message if available
        const lastAssistantMsg = [...existingConv.messages]
          .reverse()
          .find((m) => m.role === "assistant");
        if (lastAssistantMsg?.sources && lastAssistantMsg.sources.length > 0) {
          console.log("[Chat] Using cached sources:", lastAssistantMsg.sources);
          setSources(
            lastAssistantMsg.sources.map((s) => ({
              title: s.title || null,
              date: s.date || null,
              transcript_id: s.transcript_id || null,
              speakers: s.speakers || [],
              text_preview: s.text_preview || "",
              relevance_score: s.relevance_score ?? null,
            }))
          );
          setSelectedMessageId(lastAssistantMsg.id);
        }
        return;
      }

      // Load messages from backend
      console.log("[Chat] Loading messages from backend for:", conversationId);
      try {
        setIsLoading(true);
        const fullConversation = await getConversationWithMessages(
          conversationId
        );

        console.log("[Chat] Loaded conversation with messages:", {
          id: fullConversation.id,
          title: fullConversation.title,
          messageCount: fullConversation.messages.length,
          messages: fullConversation.messages.map((m) => ({
            id: m.id,
            role: m.role,
            contentPreview: m.content.slice(0, 50),
            hasSources: !!m.sources,
          })),
        });

        // Update conversation with messages including sources
        setConversations((prev) =>
          prev.map((conv) =>
            conv.id === conversationId
              ? {
                  ...conv,
                  messages: fullConversation.messages.map((msg) => ({
                    id: msg.id,
                    content: msg.content,
                    role: msg.role as "user" | "assistant",
                    timestamp: new Date(msg.created_at),
                    // Map tool result data from metadata if present (critical for persistence)
                    toolResult: (msg.metadata?.tool_result as any),
                    toolName: (msg.metadata?.tool_name as any),
                    attachments: (msg.metadata?.attachments as any),
                    // Map paired history for version navigation
                    pairedHistory: (msg.metadata?.paired_history as any),
                    sources: msg.sources?.map((s) => {
                      // Debug log for sources if needed
                      // console.log('[Chat] Mapping source:', s);
                      return {
                        title: s.title ?? undefined,
                        date: s.date ?? undefined,
                        transcript_id: s.transcript_id ?? undefined,
                        speakers: s.speakers || [],
                        text_preview: s.text_preview ?? undefined,
                        relevance_score: s.relevance_score ?? undefined,
                      };
                    }),
                  })),
                  // Load active attachments from metadata
                  activeAttachments: (fullConversation.metadata as any)?.active_attachments,
                }
              : conv
          )
        );
        setCurrentConversationId(conversationId);

        // Show sources from last assistant message
        const lastAssistantMsg = [...fullConversation.messages]
          .reverse()
          .find((m) => m.role === "assistant");
        if (lastAssistantMsg?.sources && lastAssistantMsg.sources.length > 0) {
          console.log(
            "[Chat] Last assistant message sources:",
            lastAssistantMsg.sources
          );
          setSources(
            lastAssistantMsg.sources.map((s) => ({
              title: s.title || null,
              date: s.date || null,
              transcript_id: s.transcript_id || null,
              speakers: s.speakers || [],
              text_preview: s.text_preview || "",
              relevance_score: s.relevance_score ?? null,
            }))
          );
          setSelectedMessageId(lastAssistantMsg.id);
          console.log(
            "[Chat] Loaded sources for last assistant message:",
            lastAssistantMsg.sources.length
          );
        }
      } catch (error) {
        console.error("[Chat] Failed to load conversation messages:", error);
        if (error instanceof ApiError && error.shouldReauth) {
          console.log("[Chat] Auth error, redirecting to login");
          signOut();
          router.push("/");
        }
      } finally {
        setIsLoading(false);
      }
    },
    [conversations, signOut, router]
  );

  const currentConversation =
    currentConversationId === "new"
      ? ({
          id: "new",
          title: "New Conversation",
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        } as Conversation)
      : conversations.find((c) => c.id === currentConversationId);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentConversation?.messages, streamingContent]);

  const addMessageToConversation = useCallback(
    (message: Message, targetMessageId?: string) => {
      setConversations((prev) =>
        prev.map((conv) => {
          const isTarget = targetMessageId
            ? conv.messages.some((m) => m.id === targetMessageId)
            : conv.id === currentConversationId;

          if (isTarget) {
            return {
              ...conv,
              messages: [...conv.messages, message],
              updatedAt: new Date(),
            };
          }
          return conv;
        })
      );
    },
    [currentConversationId]
  );

  const handleSendMessage = async (
    content: string,
    documentIds?: string[],
    attachments?: { id: string; name: string; type: 'pdf' | 'docx' | 'txt' | 'other'; size?: number }[]
  ) => {
    const messageId = generateUUID();

    const newUserMessage: Message = {
      id: `msg-${messageId}`,
      content,
      role: "user",
      timestamp: new Date(),
      attachments,
    };

    // Track if this is a new conversation - only 'new' counts as new
    // If we have a currentConversationId that's not 'new', we should reuse it
    const isNewConversation = currentConversationId === "new";
    let activeConversationId: string | undefined;

    console.log("[Chat] handleSendMessage:", {
      currentConversationId,
      isNewConversation,
      conversationsCount: conversations.length,
      documentIdsCount: documentIds?.length,
      attachmentsCount: attachments?.length,
      attachments
    });

    // If it's a new conversation, create a temporary one in UI
    if (isNewConversation) {
      const tempId = `temp-${generateUUID()}`;
      const newConversation: Conversation = {
        id: tempId,
        title: content.slice(0, 50) + (content.length > 50 ? "..." : ""),
        messages: [newUserMessage],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      setConversations((prev) => [newConversation, ...prev]);
      setCurrentConversationId(tempId);
      // Don't pass conversation_id - let backend create one
      activeConversationId = undefined;
      console.log("[Chat] New conversation, temp ID:", tempId);
    } else {
      // Reuse existing conversation - use currentConversationId directly
      activeConversationId = currentConversationId;
      console.log(
        "[Chat] Existing conversation, reusing ID:",
        activeConversationId
      );

      // Add user message to existing conversation
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === currentConversationId
            ? {
                ...conv,
                messages: [...conv.messages, newUserMessage],
                updatedAt: new Date(),
              }
            : conv
        )
      );
    }

    // Call the real API with conversation_id
    setIsLoading(true);
    setStreamingContent("");
    setSources([]);
    setSelectedMessageId(null);

    try {
      console.log(
        "[Chat] Calling API with conversation_id:",
        activeConversationId
      );
      const response = await sendChatMessage(
        content,
        true,
        activeConversationId,
        docType,
        meetingCategory,
        documentIds
      );
      let fullContent = "";
      let backendConversationId: string | undefined;
      let currentSources: Source[] = [];
      let timingData: TimingData | undefined;
      let confidenceData: ApiConfidenceData | undefined;
      let disclaimer: string | undefined;
      let finalToolResult: any | undefined;
      let finalToolName: any | undefined;

      // Process streaming response
      for await (const chunk of parseStreamResponse(response)) {
        if (chunk.type === "meta" && chunk.conversation_id) {
          // Backend returns the conversation_id for new conversations
          backendConversationId = chunk.conversation_id;
          console.log(
            "[Chat] Received backend conversation_id:",
            backendConversationId
          );
          
          // If backend returns user_message_id, update the temp message ID
          if (chunk.user_message_id) {
            console.log("[Chat] Received user_message_id:", chunk.user_message_id);
            // Update the user message's ID to the real backend ID
            setConversations(prev => prev.map(c => ({
              ...c,
              messages: c.messages.map(m => 
                m.id === newUserMessage.id 
                  ? { ...m, id: chunk.user_message_id as string }
                  : m
              )
            })));
          }
        } else if (chunk.type === "sources") {
          currentSources = chunk.content as Source[];
          setSources(currentSources);
          console.log("[Chat] Received sources:", currentSources.length);
          console.log(
            "[Chat] Sources data:",
            JSON.stringify(currentSources, null, 2)
          );
        } else if (chunk.type === "token") {
          fullContent += chunk.content as string;
          setStreamingContent(fullContent);
        } else if (chunk.type === "timing") {
          timingData = chunk.content as TimingData;
          console.log("[Chat] Received timing data:", timingData);
        } else if (chunk.type === "confidence") {
          confidenceData = chunk.content as ApiConfidenceData;
          disclaimer = chunk.disclaimer;
          console.log("[Chat] Received confidence data:", confidenceData);
          if (disclaimer) {
            console.log("[Chat] Received disclaimer:", disclaimer);
          }
        } else if (chunk.type === "tool_call") {
          // Tool is starting
          console.log("[Chat] Tool call starting:", chunk.tool);
          setToolState({
            isActive: true,
            toolName: chunk.tool,
            status: "starting",
            args: chunk.args,
          });
          finalToolName = chunk.tool;
        } else if (chunk.type === "tool_progress") {
          // Tool is processing
          console.log("[Chat] Tool progress:", chunk.message);
          setToolState(prev => ({
            ...prev,
            status: 'processing',
            message: chunk.message,
          }));
        } else if (chunk.type === "tool_result") {
          // Tool completed successfully
          console.log("[Chat] Tool result:", chunk.data);
          
          // Check for sources in tool data and update state
          // Note: Backend tool sources have format { title, date, score } which maps loosely to Source
          if (chunk.data && chunk.data.sources && Array.isArray(chunk.data.sources) && chunk.data.sources.length > 0) {
             console.log("[Chat] Received sources from tool:", chunk.data.sources.length);
             const toolSources = chunk.data.sources.map((s: any) => ({
                title: s.title,
                date: s.date,
                transcript_id: null,
                speakers: [],
                text_preview: "Source used for infographic generation",
                relevance_score: s.score || null
             }));
             setSources(toolSources);
             currentSources = toolSources;
          }

          setToolState((prev) => ({
            ...prev,
            status: "complete",
            result: chunk.data,
          }));
          finalToolResult = chunk.data;
        } else if (chunk.type === "tool_error") {
          // Tool failed
          console.log("[Chat] Tool error:", chunk.error);
          setToolState(prev => ({
            ...prev,
            status: 'error',
            error: chunk.error,
          }));
        }
      }

      // If this was a new conversation, update the temp ID with the real backend ID
      if (isNewConversation && backendConversationId) {
        console.log(
          "[Chat] Updating temp ID to backend ID:",
          backendConversationId
        );
        setConversations((prev) =>
          prev.map((conv) =>
            conv.id.startsWith("temp-")
              ? { ...conv, id: backendConversationId! }
              : conv
          )
        );
        setCurrentConversationId(backendConversationId);
      }

      // Create the final AI message with sources, confidence, timing attached
      const aiMessageId = `msg-${generateUUID()}`;
      const aiResponse: Message = {
        id: aiMessageId,
        // If we have tool result, we don't need the fallback message.
        // Or we keep it as a summary if content is empty?
        // If content is empty but toolResult exists, use "View result below" or similar, or empty string if UI handles it.
        // For now, keep fallback only if BOTH are missing.
        content: fullContent || (finalToolResult ? "" : "I received your message but had no response."),
        role: "assistant",
        timestamp: new Date(),
        sources: currentSources as MessageSource[], // Store sources with the message
        confidence: confidenceData as ConfidenceData | undefined, // Store confidence data
        disclaimer: disclaimer, // Store disclaimer for low confidence
        timings: timingData
          ? {
              retrieval_ms: timingData.retrieval_ms,
              generation_ms: timingData.generation_ms,
              total_ms: timingData.total_ms,
              prompt_build_ms: timingData.prompt_ms,
            }
          : undefined,
        toolResult: finalToolResult,
        toolName: finalToolName,
      };

      // Set this message as selected to show its sources
      setSelectedMessageId(aiMessageId);

      // Add to the correct conversation (use backend ID if available)
      const targetConvId = backendConversationId || activeConversationId;
      console.log("[Chat] Adding AI response to conversation:", targetConvId);
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === targetConvId ||
          (isNewConversation && conv.id.startsWith("temp-"))
            ? {
                ...conv,
                messages: [...conv.messages, aiResponse],
                updatedAt: new Date(),
              }
            : conv
        )
      );
    } catch (error) {
      console.error("Chat error:", error);

      // Handle auth errors
      if (error instanceof ApiError && error.shouldReauth) {
        signOut();
        router.push("/");
        return;
      }

      // Add error message
      const errorMessage: Message = {
        id: `msg-${generateUUID()}`,
        content: `Sorry, I encountered an error: ${
          error instanceof Error ? error.message : "Unknown error"
        }. Please make sure the backend is running.`,
        role: "assistant",
        timestamp: new Date(),
      };

      addMessageToConversation(errorMessage, newUserMessage.id);
    } finally {
      setIsLoading(false);
      setStreamingContent("");
      // Reset tool state after completion
      setToolState({ isActive: false });
    }
  };

  const handleEditMessage = async (messageId: string, newContent: string) => {
    console.log("[Chat] handleEditMessage:", { messageId, newContent });

    // 1. Truncate messages in UI immediately
    const convIndex = conversations.findIndex(c => c.id === currentConversationId);
    if (convIndex === -1) return;
    
    const conv = conversations[convIndex];
    const msgIndex = conv.messages.findIndex(m => m.id === messageId);
    if (msgIndex === -1) return;

    // Capture the assistant response that follows this message (if any)
    const assistantResponse = conv.messages[msgIndex + 1];
    const oldAssistantContent = assistantResponse?.role === 'assistant' ? assistantResponse.content : '';
    
    // Keep messages up to the edited one (truncate the rest)
    const truncatedMessages = conv.messages.slice(0, msgIndex + 1);
    const originalMessage = truncatedMessages[msgIndex];
    
    // Preserve paired history: add old input + old response to history before updating
    const existingHistory = originalMessage.pairedHistory || [];
    const updatedHistory = [...existingHistory, { 
      userContent: originalMessage.content, 
      assistantContent: oldAssistantContent 
    }];
    
    // Update content and preserve history
    truncatedMessages[msgIndex] = {
      ...originalMessage,
      content: newContent,
      pairedHistory: updatedHistory,
    };

    setConversations(prev => prev.map(c => 
      c.id === currentConversationId 
        ? { ...c, messages: truncatedMessages } 
        : c
    ));
    
    // 2. Call API
    setIsLoading(true);
    setStreamingContent("");
    setSources([]);
    setSelectedMessageId(null);
    setToolState({ isActive: false });

    try {
      const response = await editMessage(currentConversationId, messageId, newContent, true);
      
      let fullContent = "";
      let currentSources: Source[] = [];
      let timingData: TimingData | undefined;
      let confidenceData: ApiConfidenceData | undefined;
      let disclaimer: string | undefined;
      let finalToolResult: any | undefined;
      let finalToolName: any | undefined;

      // Process streaming response
      for await (const chunk of parseStreamResponse(response)) {
         if (chunk.type === "token") {
            fullContent += chunk.content as string;
            setStreamingContent(fullContent);
         } else if (chunk.type === "sources") {
            currentSources = chunk.content as Source[];
            setSources(currentSources);
         } else if (chunk.type === "timing") {
            timingData = chunk.content as TimingData;
         } else if (chunk.type === "confidence") {
            confidenceData = chunk.content as ApiConfidenceData;
            disclaimer = chunk.disclaimer;
         } else if (chunk.type === "tool_call") {
             setToolState({
                isActive: true,
                toolName: chunk.tool,
                status: "starting",
                args: chunk.args,
             });
             finalToolName = chunk.tool;
         } else if (chunk.type === "tool_progress") {
             setToolState(prev => ({ ...prev, status: 'processing', message: chunk.message }));
         } else if (chunk.type === "tool_result") {
             // Handle tool sources if present
             if (chunk.data && chunk.data.sources && Array.isArray(chunk.data.sources) && chunk.data.sources.length > 0) {
                 const toolSources = chunk.data.sources.map((s: any) => ({
                    title: s.title,
                    date: s.date,
                    transcript_id: null,
                    speakers: [],
                    text_preview: "Source used for creation",
                    relevance_score: s.score || null
                 }));
                 setSources(toolSources);
                 currentSources = toolSources;
             }
             setToolState(prev => ({ ...prev, status: "complete", result: chunk.data }));
             finalToolResult = chunk.data;
         } else if (chunk.type === "tool_error") {
             setToolState(prev => ({ ...prev, status: 'error', error: chunk.error }));
         }
      }

      // 3. Add Assistant Response
      const aiMessageId = `msg-${generateUUID()}`;
      const aiResponse: Message = {
        id: aiMessageId,
        content: fullContent || (finalToolResult ? "" : "I received your message but had no response."),
        role: "assistant",
        timestamp: new Date(),
        sources: currentSources as MessageSource[],
        confidence: confidenceData as ConfidenceData | undefined,
        disclaimer: disclaimer,
        timings: timingData ? {
            retrieval_ms: timingData.retrieval_ms,
            generation_ms: timingData.generation_ms,
            total_ms: timingData.total_ms,
            prompt_build_ms: timingData.prompt_ms,
        } : undefined,
        toolResult: finalToolResult,
        toolName: finalToolName,
      };

      setSelectedMessageId(aiMessageId);

      setConversations(prev => prev.map(c => 
        c.id === currentConversationId 
          ? { ...c, messages: [...c.messages, aiResponse], updatedAt: new Date() } 
          : c
      ));

    } catch (error) {
      console.error("Edit error:", error);
      if (error instanceof ApiError && error.shouldReauth) {
        signOut();
        router.push("/");
      }
    } finally {
      setIsLoading(false);
      setStreamingContent("");
      setToolState({ isActive: false });
    }
  };

  const handleNewConversation = () => {
    setCurrentConversationId("new");
  };

  const handleDeleteConversation = async (id: string) => {
    // Optimistically remove from UI
    setConversations((prev) => prev.filter((conv) => conv.id !== id));
    if (currentConversationId === id) {
      const remaining = conversations.filter((conv) => conv.id !== id);
      if (remaining.length > 0) {
        setCurrentConversationId(remaining[0].id);
      } else {
        handleNewConversation();
      }
    }

    // Delete from backend
    try {
      await apiDeleteConversation(id);
    } catch (error) {
      console.error("Failed to delete conversation:", error);
      // Could restore the conversation here if needed
    }
  };

  const handleLogout = () => {
    signOut();
    router.push("/");
  };

  if (isLoadingHistory) {
    return (
      <div className="flex items-center justify-center h-screen bg-[var(--background)]">
        <div className="animate-pulse text-[var(--foreground-secondary)]">
          Loading conversations...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <ProtectedRoute>
        <div className="flex items-center justify-center h-screen bg-[var(--background)] p-4">
          <div className="max-w-md w-full space-y-4">
             <Alert 
               variant="error" 
               title="Connection Error"
               action={
                 <Button onClick={handleRetryLoad} variant="secondary" size="sm">
                   Retry Connection
                 </Button>
               }
             >
               {error}
             </Alert>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  if (!currentConversation) {
    return (
      <div className="flex items-center justify-center h-screen bg-[var(--background)]">
        <div className="animate-pulse text-[var(--foreground-secondary)]">
          Loading...
        </div>
      </div>
    );
  }

  // Handler for clicking a message to show its sources
  const handleSelectMessage = (messageId: string) => {
    console.log("[Chat] Message selected:", messageId);
    setSelectedMessageId(messageId);

    // Find the message and update sources in sidebar
    const message = currentConversation?.messages.find(
      (m) => m.id === messageId
    );
    if (message?.sources && message.sources.length > 0) {
      console.log(
        "[Chat] Updating sidebar sources from message:",
        message.sources
      );
      // Map MessageSource to Source type for the sidebar
      setSources(
        message.sources.map((s) => ({
          title: s.title || null,
          date: s.date || null,
          transcript_id: s.transcript_id || null,
          speakers: s.speakers || [],
          text_preview: s.text_preview || "",
          relevance_score: s.relevance_score ?? null,
        }))
      );
    }
  };

  return (
    <ProtectedRoute>
      <ChatLayout
        conversations={conversations}
        currentConversationId={currentConversationId}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        onDeleteConversation={handleDeleteConversation}
        onLogout={handleLogout}
        title={currentConversation.title}
        showHeader={currentConversation.messages.length > 0}
        sources={sources}
      >
        <div className="relative flex-1 flex flex-col h-full overflow-hidden">
          {/* Messages Area - scrolls behind the input */}
          <div
            className={`flex-1 overflow-y-auto ${
              currentConversation.messages.length > 0 ? "pb-32" : ""
            }`}
          >
            {currentConversation.messages.length === 0 ? (
              <HomeView onSendMessage={handleSendMessage} />
            ) : (
              <div className="max-w-2xl mx-auto py-4 px-4 w-full">
                {currentConversation.messages.map((message) => (
                  <ChatMessage
                    key={message.id}
                    message={message}
                    isSelected={selectedMessageId === message.id}
                    onSelectMessage={handleSelectMessage}
                    onEdit={handleEditMessage}
                  />
                ))}
                {(isLoading || streamingContent) && !toolState.isActive && (
                  <ChatMessage
                    message={{
                      id: "streaming",
                      content: streamingContent,
                      role: "assistant",
                      timestamp: new Date(),
                    }}
                    isLoading={isLoading && !streamingContent}
                  />
                )}
                {/* Tool UI - shows when a tool is being used */}
                {toolState.isActive && toolState.toolName && (
                  <div className="max-w-2xl mx-auto">
                    <ToolCallBlock
                      toolName={toolState.toolName as "infographic_generator" | "content_writer"}
                      status={toolState.status || "starting"}
                      message={toolState.message}
                      args={toolState.args}
                    />
                    {toolState.status === "complete" && toolState.result && (
                      <ToolResultBlock
                        toolName={toolState.toolName as "infographic_generator" | "content_writer"}
                        data={toolState.result}
                      />
                    )}
                    {toolState.status === "error" && toolState.error && (
                      <div className="p-4 rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30 text-red-700 dark:text-red-300 text-sm">
                        Error: {toolState.error}
                      </div>
                    )}
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input Area - Fixed floating at bottom when there are messages */}
          {currentConversation.messages.length > 0 && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[var(--background)] via-[var(--background)] to-transparent pt-8">
              <ChatInput
                onSendMessage={handleSendMessage}
                disabled={isLoading}
                placeholder="Continue the conversation..."
                docType={docType}
                onDocTypeChange={setDocType}
                meetingCategory={meetingCategory}
                onMeetingCategoryChange={setMeetingCategory}
                initialAttachments={currentConversation.activeAttachments}
              />
            </div>
          )}
        </div>
      </ChatLayout>
    </ProtectedRoute>
  );
}
