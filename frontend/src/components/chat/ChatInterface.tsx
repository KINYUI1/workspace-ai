import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, ChevronDown, Wrench, Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { clsx } from 'clsx';
import { useChatStore } from '@/stores/chat.store';
import { useAgentStore } from '@/stores/agent.store';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useSpeechSynthesis } from '@/hooks/useSpeechSynthesis';
import { StreamingMessage } from './StreamingMessage';
import { api } from '@/services/api';
import { toast } from '@/components/common/Toast';
import type { Agent } from '@/types';

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-500',
  idle: 'bg-green-500',
  busy: 'bg-amber-500',
  error: 'bg-red-500',
  offline: 'bg-gray-500',
};

interface UsageInfo {
  used: number;
  limit: number | null;
  remaining: number | null;
  unlimited: boolean;
}

export function ChatInterface() {
  const [input, setInput] = useState('');
  const [showAgentPicker, setShowAgentPicker] = useState(false);
  const [targetAgent, setTargetAgent] = useState<Agent | null>(null);
  const [autoRead, setAutoRead] = useState(false);
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(0);
  const { messages, isLoading, sendMessage, loadHistory,
    isStreaming, streamingAgentName, streamingText, streamingThinking,
    streamingTools, streamingUsage } = useChatStore();
  const { agents, mainAgent, fetchAgents } = useAgentStore();

  // Speech hooks
  const {
    isListening,
    transcript,
    isSupported: sttSupported,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition();

  const {
    isSpeaking,
    speakingId,
    isSupported: ttsSupported,
    speak,
    stop: stopSpeaking,
  } = useSpeechSynthesis();

  // Sync transcript into input field while listening
  useEffect(() => {
    if (isListening && transcript) {
      setInput(transcript);
    }
  }, [transcript, isListening]);

  // Auto-read new agent messages
  useEffect(() => {
    if (!autoRead || !ttsSupported) return;
    if (messages.length > prevMessageCountRef.current) {
      const newMessages = messages.slice(prevMessageCountRef.current);
      const lastAgentMsg = [...newMessages].reverse().find(
        (m) => m.role === 'agent' && m.content && !m.action && !m.isThinking,
      );
      if (lastAgentMsg) {
        speak(lastAgentMsg.content, lastAgentMsg.id);
      }
    }
    prevMessageCountRef.current = messages.length;
  }, [messages.length, autoRead, ttsSupported, speak]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch usage limit info
  useEffect(() => {
    api.getUsageLimit().then((res) => {
      if (res.success && res.data) setUsage(res.data as unknown as UsageInfo);
    }).catch(() => {});
  }, [messages.length]); // refresh after each message

  // Fetch all agents so the picker has data
  useEffect(() => {
    if (agents.length === 0) fetchAgents();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Default target to main agent
  useEffect(() => {
    if (!targetAgent && mainAgent) {
      setTargetAgent(mainAgent);
    }
  }, [mainAgent, targetAgent]);

  // Load history for the target agent
  useEffect(() => {
    if (targetAgent) {
      loadHistory(targetAgent.id);
    }
  }, [targetAgent?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close picker on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowAgentPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText, streamingTools]);

  const limitReached = usage !== null && !usage.unlimited && usage.remaining !== null && usage.remaining <= 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !targetAgent) return;
    if (limitReached) {
      toast.error('Daily prompt limit reached. Your limit resets on a rolling 24-hour basis.');
      return;
    }
    // Stop listening if active
    if (isListening) {
      stopListening();
      resetTranscript();
    }
    sendMessage(input.trim(), targetAgent.id);
    setInput('');
  };

  const handleMicToggle = () => {
    if (isListening) {
      stopListening();
    } else {
      resetTranscript();
      startListening();
    }
  };

  const handleSpeakMessage = (messageId: string, content: string) => {
    if (isSpeaking && speakingId === messageId) {
      stopSpeaking();
    } else {
      speak(content, messageId);
    }
  };

  const handleSelectAgent = (agent: Agent) => {
    setTargetAgent(agent);
    setShowAgentPicker(false);
  };

  const activeAgent = targetAgent || mainAgent;

  return (
    <div className="flex h-full flex-col rounded-xl border border-border bg-surface">
      {/* Header with agent selector */}
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="relative" ref={pickerRef}>
          <button
            onClick={() => setShowAgentPicker(!showAgentPicker)}
            className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-light"
          >
            <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-primary-600">
              <Bot size={16} className="text-white" />
              {activeAgent && (
                <span
                  className={clsx(
                    'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface',
                    STATUS_COLORS[activeAgent.status] || 'bg-gray-500',
                  )}
                />
              )}
            </div>
            <div className="text-left">
              <h3 className="text-sm font-semibold text-text-primary">
                {activeAgent?.name ?? 'Select Agent'}
              </h3>
              <p className="text-xs text-text-secondary">
                {activeAgent?.isMainAgent ? 'Main Agent' : activeAgent?.role || 'Agent'}
                {activeAgent && ` \u00b7 ${activeAgent.status}`}
              </p>
            </div>
            <ChevronDown
              size={14}
              className={clsx(
                'text-text-secondary transition-transform',
                showAgentPicker && 'rotate-180',
              )}
            />
          </button>

          {/* Agent picker dropdown */}
          {showAgentPicker && (
            <div className="absolute left-0 top-full z-20 mt-1 w-72 rounded-xl border border-border bg-background shadow-xl">
              <div className="max-h-64 overflow-y-auto p-1.5">
                {agents.length === 0 ? (
                  <p className="px-3 py-4 text-center text-xs text-text-secondary">
                    No agents found
                  </p>
                ) : (
                  agents.map((agent) => (
                    <button
                      key={agent.id}
                      onClick={() => handleSelectAgent(agent)}
                      className={clsx(
                        'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
                        targetAgent?.id === agent.id
                          ? 'bg-primary-600/10 text-primary-400'
                          : 'text-text-primary hover:bg-surface-light',
                      )}
                    >
                      <div className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-600/20">
                        <Bot size={12} className="text-primary-400" />
                        <span
                          className={clsx(
                            'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background',
                            STATUS_COLORS[agent.status] || 'bg-gray-500',
                          )}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {agent.name}
                          {agent.isMainAgent && (
                            <span className="ml-1.5 text-[10px] font-normal text-primary-400">
                              MAIN
                            </span>
                          )}
                        </p>
                        <p className="truncate text-xs text-text-secondary">
                          {agent.role}
                          {agent.specialty.length > 0 && ` \u00b7 ${agent.specialty.slice(0, 2).join(', ')}`}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Auto-read toggle */}
        {ttsSupported && (
          <button
            onClick={() => setAutoRead(!autoRead)}
            className={clsx(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              autoRead
                ? 'bg-primary-600/20 text-primary-400'
                : 'text-text-secondary hover:bg-surface-light hover:text-text-primary',
            )}
            title={autoRead ? 'Auto-read is on' : 'Auto-read agent responses'}
          >
            <Volume2 size={14} />
            Auto-read
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-text-secondary">
            <Bot size={48} className="mb-4 opacity-30" />
            <p className="text-sm">Send a message to get started.</p>
            <p className="mt-1 text-xs opacity-60">
              {activeAgent?.isMainAgent
                ? 'Ask your main agent to create teams, assign tasks, or get updates.'
                : `Talk directly to ${activeAgent?.name ?? 'this agent'}.`}
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={clsx(
              'flex gap-3',
              msg.role === 'user' ? 'justify-end' : 'justify-start',
            )}
          >
            {msg.role === 'agent' && (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-600/20">
                {msg.action ? (
                  <Wrench size={12} className="text-amber-400" />
                ) : (
                  <Bot size={14} className="text-primary-400" />
                )}
              </div>
            )}

            <div
              className={clsx(
                'max-w-[75%] rounded-xl px-4 py-2.5 text-sm',
                msg.role === 'user'
                  ? 'bg-primary-600 text-white'
                  : msg.action
                    ? 'border border-amber-500/20 bg-amber-500/5 text-text-primary'
                    : 'border border-border bg-surface-light text-text-primary',
              )}
            >
              {msg.role === 'agent' && msg.agentName && (
                <p className="mb-1 text-xs font-semibold text-primary-400">
                  {msg.agentName}
                </p>
              )}
              {msg.action && (
                <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-amber-400">
                  {msg.action.type}
                </p>
              )}
              {msg.isThinking ? (
                <div className="flex items-center gap-2 text-text-secondary">
                  <Loader2 size={14} className="animate-spin" />
                  <span>Thinking...</span>
                </div>
              ) : (
                <p className="whitespace-pre-wrap">
                  {msg.action ? msg.action.details : msg.content}
                </p>
              )}
              <div className="mt-1 flex items-center justify-between gap-2">
                <p
                  className={clsx(
                    'text-xs',
                    msg.role === 'user' ? 'text-white/60' : 'text-text-secondary',
                  )}
                >
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>

                {/* TTS button on agent text messages */}
                {ttsSupported && msg.role === 'agent' && msg.content && !msg.action && !msg.isThinking && (
                  <button
                    onClick={() => handleSpeakMessage(msg.id, msg.content)}
                    className="rounded p-0.5 text-text-secondary transition-colors hover:text-primary-400"
                    title={isSpeaking && speakingId === msg.id ? 'Stop reading' : 'Read aloud'}
                  >
                    {isSpeaking && speakingId === msg.id ? (
                      <VolumeX size={12} className="text-primary-400" />
                    ) : (
                      <Volume2 size={12} />
                    )}
                  </button>
                )}
              </div>
            </div>

            {msg.role === 'user' && (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-light">
                <User size={14} className="text-text-secondary" />
              </div>
            )}
          </div>
        ))}

        {/* Live streaming message */}
        {isStreaming && (
          <StreamingMessage
            agentName={streamingAgentName}
            text={streamingText}
            thinking={streamingThinking}
            tools={streamingTools}
            usage={streamingUsage}
          />
        )}

        <div ref={bottomRef} />
      </div>

      {/* Listening indicator */}
      {isListening && (
        <div className="flex items-center gap-2 border-t border-red-500/20 bg-red-500/5 px-5 py-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
          <span className="text-xs text-red-400">Listening...</span>
          <span className="text-xs text-text-secondary">Speak now, then press send</span>
        </div>
      )}

      {/* Usage limit banner */}
      {limitReached && (
        <div className="flex items-center gap-2 border-t border-amber-500/20 bg-amber-500/5 px-5 py-2">
          <span className="text-xs font-medium text-amber-400">
            Daily prompt limit reached ({usage!.limit} / day). Resets on a rolling 24-hour basis.
          </span>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className={clsx('border-t border-border px-5 py-3', (isListening || limitReached) && 'border-t-0')}>
        {/* Usage counter */}
        {usage && !usage.unlimited && !limitReached && (
          <div className="mb-2 flex items-center gap-1.5 text-[10px] text-text-secondary">
            <div className="flex-1 h-1 rounded-full bg-surface-light overflow-hidden">
              <div
                className={clsx(
                  'h-full rounded-full transition-all',
                  usage.remaining! <= 1 ? 'bg-amber-500' : 'bg-primary-500',
                )}
                style={{ width: `${((usage.used) / usage.limit!) * 100}%` }}
              />
            </div>
            <span>{usage.remaining} / {usage.limit} prompts remaining</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          {/* Mic button */}
          {sttSupported && (
            <button
              type="button"
              onClick={handleMicToggle}
              className={clsx(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors',
                isListening
                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                  : 'text-text-secondary hover:bg-surface-light hover:text-text-primary',
              )}
              title={isListening ? 'Stop listening' : 'Speak a message'}
            >
              {isListening ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
          )}

          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={limitReached ? 'Prompt limit reached — resets in 24h' : isListening ? 'Listening...' : `Message ${activeAgent?.name ?? 'Agent'}...`}
            className="flex-1 rounded-lg border border-border bg-bg px-4 py-2.5 text-sm text-text-primary placeholder-text-secondary outline-none focus:border-primary-500"
            disabled={!activeAgent || isLoading || isStreaming || limitReached}
          />
          <button
            type="submit"
            disabled={!input.trim() || !activeAgent || isLoading || isStreaming || limitReached}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-600 text-white transition-colors hover:bg-primary-700 disabled:opacity-40 disabled:hover:bg-primary-600"
            aria-label="Send message"
          >
            {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
      </form>
    </div>
  );
}
