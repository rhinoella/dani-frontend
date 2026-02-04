"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ChatLayout from "@/components/layouts/ChatLayout";
import BeeBotLayout from "@/components/layouts/BeeBotLayout";
import BeeBotEmptyState from "@/components/chat/BeeBotEmptyState";
import BeeBotInput from "@/components/chat/BeeBotInput";
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

export default function ChatContent() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] =
    useState<string | null>(null); // Start as null, will be set from URL or 'new'
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
  const loadingConversationRef = useRef<string | null>(null); // Track which conversation is being loaded
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signOut, isAuthenticated, isLoading: isAuthLoading, user } = useAuth();

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
  // Also restore conversation on page refresh
  useEffect(() => {
    const conversationParam = searchParams.get('conversation');
    if (conversationParam && conversationParam !== 'new') {
      setPendingConversationId(conversationParam);
    } else if (!conversationParam) {
      // No URL param - default to 'new' (only on initial load)
      setCurrentConversationId('new');
    }
  }, [searchParams]); // Removed currentConversationId to prevent loop

  // Select pending conversation once conversations are loaded
  useEffect(() => {
    // Early exit if no pending conversation or still loading
    if (!pendingConversationId || isLoadingHistory) {
      return;
    }
    
    // Wait for conversations to be loaded
    if (conversations.length === 0) {
      return;
    }
    
    // Prevent duplicate loads - check ref first
    if (loadingConversationRef.current === pendingConversationId) {
      return;
    }
    
    const existingConv = conversations.find(c => c.id === pendingConversationId);
    if (!existingConv) {
      // Conversation not found, clear pending and go to new
      console.log('[Chat] Pending conversation not found:', pendingConversationId);
      setPendingConversationId(null);
      setCurrentConversationId('new');
      return;
    }
    
    // Check if messages are already loaded - if so, just set the conversation ID
    if (existingConv.messages.length > 0) {
      console.log('[Chat] Messages already loaded for pending conversation');
      setCurrentConversationId(pendingConversationId);
      setPendingConversationId(null);
      
      // Restore sources from last assistant message
      const lastAssistantMsg = [...existingConv.messages]
        .reverse()
        .find((m) => m.role === "assistant");
      if (lastAssistantMsg?.sources && lastAssistantMsg.sources.length > 0) {
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
    
    // Mark as loading to prevent duplicate calls - BEFORE clearing pending
    loadingConversationRef.current = pendingConversationId;
    const conversationToLoad = pendingConversationId;
    
    // Clear pending immediately to prevent re-triggering
    setPendingConversationId(null);
    setCurrentConversationId(conversationToLoad);
    
    // Update URL to preserve conversation on refresh
    router.replace(`/chat?conversation=${conversationToLoad}`, { scroll: false });
    
    // Load messages for this conversation
    console.log('[Chat] Loading messages for pending conversation:', conversationToLoad);
    getConversationWithMessages(conversationToLoad).then(response => {
      // Debug: Log raw API response
      console.log('[Chat] Raw API response messages:', response.messages.map((m) => ({
        id: m.id,
        role: m.role,
        hasMetadata: !!m.metadata,
        metadataKeys: m.metadata ? Object.keys(m.metadata) : null,
        hasToolResult: !!m.metadata?.tool_result,
        hasToolName: !!m.metadata?.tool_name,
        toolResultKeys: m.metadata?.tool_result ? Object.keys(m.metadata.tool_result) : null,
      })));
      
      const messages: Message[] = response.messages.map((m) => {
        // Debug attachments presence
        if (m.metadata?.attachments) {
          console.log(`[Chat] Message ${m.id} has attachments:`, m.metadata.attachments);
        }

        return {
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.content,
          timestamp: new Date(m.created_at),
          // Map tool result data from metadata
          toolResult: (m.metadata?.tool_result as any),
          toolName: (m.metadata?.tool_name as any),
          // Map attachments from metadata for document display - explicit array check
          attachments: (m.metadata?.attachments && Array.isArray(m.metadata.attachments)) 
            ? (m.metadata.attachments as any) 
            : undefined,
          // Map paired history for version navigation
          pairedHistory: (m.metadata?.paired_history as any),
          sources: (m.sources || []).map((s) => ({
            title: s.title || undefined,
            date: s.date || undefined,
            transcript_id: s.transcript_id || undefined,
            speakers: s.speakers || [],
            text_preview: s.text_preview || "",
            relevance_score: s.relevance_score ?? undefined,
          })),
        };
      });
      
      setConversations(prev => prev.map(c => 
        c.id === conversationToLoad ? { ...c, messages } : c
      ));
      
      // Show sources from last assistant message
      const lastAssistantMsg = messages.slice().reverse().find(m => m.role === 'assistant');
      if (lastAssistantMsg?.sources && lastAssistantMsg.sources.length > 0) {
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
      
      // Clear loading ref after successful load
      loadingConversationRef.current = null;
    }).catch(err => {
      console.error('[Chat] Failed to load conversation messages:', err);
      loadingConversationRef.current = null;
    });
  }, [pendingConversationId, conversations, isLoadingHistory, router]);

  // Load messages when a conversation is selected
  const handleSelectConversation = useCallback(
    async (conversationId: string) => {
      console.log("[Chat] handleSelectConversation called:", conversationId);

      if (conversationId === "new") {
        console.log("[Chat] Starting new conversation");
        setCurrentConversationId("new");
        loadingConversationRef.current = null;
        // Clear sources for new conversation
        setSources([]);
        setSelectedMessageId(null);
        // Update URL to reflect new conversation
        router.replace('/chat', { scroll: false });
        return;
      }

      // Prevent duplicate loads for the same conversation
      if (loadingConversationRef.current === conversationId) {
        console.log("[Chat] Already loading conversation:", conversationId);
        return;
      }

      // Update URL to persist conversation selection on refresh
      router.replace(`/chat?conversation=${conversationId}`, { scroll: false });

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
        loadingConversationRef.current = null;
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
        } else {
          // Clear sources if no sources on last message
          console.log("[Chat] No sources on last assistant message, clearing");
          setSources([]);
          setSelectedMessageId(null);
        }
        return;
      }

      // Mark as loading to prevent duplicate calls
      loadingConversationRef.current = conversationId;

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
                  messages: fullConversation.messages.map((msg) => {
                    // Debug: Log tool result when loading from history
                    if (msg.metadata?.tool_result) {
                      console.log('[Chat] Loading message with tool_result:', {
                        msgId: msg.id,
                        toolName: msg.metadata?.tool_name,
                        hasImage: !!(msg.metadata?.tool_result as any)?.image,
                        hasImageUrl: !!(msg.metadata?.tool_result as any)?.image_url,
                        hasS3Key: !!(msg.metadata?.tool_result as any)?.s3_key,
                        s3Key: (msg.metadata?.tool_result as any)?.s3_key,
                      });
                    }
                    return {
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
                    };
                  }),
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
        } else {
          // Clear sources if no sources found
          console.log("[Chat] No sources on last assistant message from backend, clearing");
          setSources([]);
          setSelectedMessageId(null);
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
        loadingConversationRef.current = null; // Clear loading ref
      }
    },
    [conversations, signOut, router]
  );

  const currentConversation =
    currentConversationId === "new" || currentConversationId === null
      ? ({
          id: "new",
          title: "New Conversation",
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        } as Conversation)
      : conversations.find((c) => c.id === currentConversationId) || ({
          id: currentConversationId || "new",
          title: "Conversation",
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        } as Conversation);

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
    const isNewConversation = currentConversationId === "new" || currentConversationId === null;
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
          // Backend sends: { title, date, score (raw), relevance_score (0-100), text_preview, ... }
          if (chunk.data && chunk.data.sources && Array.isArray(chunk.data.sources) && chunk.data.sources.length > 0) {
             console.log("[Chat] Received sources from tool:", chunk.data.sources.length);
             const toolSources = chunk.data.sources.map((s: any) => ({
                title: s.title,
                date: s.date,
                transcript_id: null,
                speakers: [],
                text_preview: s.text_preview || s.text || "Source used for infographic generation",
                text: s.text || s.text_preview,
                // Use relevance_score (already normalized 0-100) from backend, not raw score
                relevance_score: s.relevance_score ?? null,
                relevance_label: s.relevance_label,
                meeting_category: s.meeting_category,
                category_confidence: s.category_confidence,
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
      console.log("[Chat] Adding AI response to conversation:", targetConvId, "isNewConversation:", isNewConversation);
      setConversations((prev) => {
        console.log("[Chat] Current conversations:", prev.map(c => ({ id: c.id, msgCount: c.messages.length })));
        return prev.map((conv) => {
          const shouldUpdate = conv.id === targetConvId ||
            (isNewConversation && conv.id.startsWith("temp-")) ||
            (isNewConversation && conv.id === backendConversationId);
          
          if (shouldUpdate) {
            console.log("[Chat] Adding AI response to conv:", conv.id);
          }
          
          return shouldUpdate
            ? {
                ...conv,
                messages: [...conv.messages, aiResponse],
                updatedAt: new Date(),
              }
            : conv;
        });
      });
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

    if (!currentConversationId) {
      console.error("[Chat] Cannot edit message: no conversation selected");
      return;
    }

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
             // Backend sends: { title, date, score (raw), relevance_score (0-100), text_preview, ... }
             if (chunk.data && chunk.data.sources && Array.isArray(chunk.data.sources) && chunk.data.sources.length > 0) {
                 const toolSources = chunk.data.sources.map((s: any) => ({
                    title: s.title,
                    date: s.date,
                    transcript_id: null,
                    speakers: [],
                    text_preview: s.text_preview || s.text || "Source used for creation",
                    text: s.text || s.text_preview,
                    // Use relevance_score (already normalized 0-100) from backend
                    relevance_score: s.relevance_score ?? null,
                    relevance_label: s.relevance_label,
                    meeting_category: s.meeting_category,
                    category_confidence: s.category_confidence,
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
    console.log("[Chat] handleDeleteConversation called with id:", id);
    
    // Skip backend call for temp conversations (not yet saved)
    if (id.startsWith('temp-')) {
      console.log("[Chat] Removing temp conversation from UI only:", id);
      setConversations((prev) => prev.filter((conv) => conv.id !== id));
      if (currentConversationId === id) {
        const remaining = conversations.filter((conv) => conv.id !== id);
        if (remaining.length > 0) {
          setCurrentConversationId(remaining[0].id);
        } else {
          handleNewConversation();
        }
      }
      return;
    }
    
    // Store for potential restoration
    const conversationToDelete = conversations.find(c => c.id === id);
    
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
      console.log("[Chat] Delete successful for:", id);
    } catch (error) {
      console.error("[Chat] Failed to delete conversation:", error);
      // Restore the conversation if deletion failed
      if (conversationToDelete) {
        console.log("[Chat] Restoring conversation after failed delete");
        setConversations((prev) => [conversationToDelete, ...prev]);
      }
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
      <BeeBotLayout
        conversations={conversations}
        currentConversationId={currentConversationId || "new"}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        user={user}
        sources={sources}
      >
        <div className="relative flex-1 flex flex-col overflow-hidden bg-white">
          {/* Content Area */}
          <div className="flex-1 overflow-y-auto">
            {currentConversation.messages.length === 0 ? (
              <BeeBotEmptyState userName={user?.name || null} />
            ) : (
              <div className="max-w-3xl mx-auto py-4 px-8 w-full pb-40">
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
                {toolState.isActive && toolState.toolName && (
                  <div>
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
                      <div className="p-4 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm">
                        Error: {toolState.error}
                      </div>
                    )}
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Fixed Input at Bottom */}
          <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100">
            <BeeBotInput
              onSendMessage={(msg) => handleSendMessage(msg)}
              disabled={isLoading}
            />
          </div>
        </div>
      </BeeBotLayout>
    </ProtectedRoute>
  );
}
