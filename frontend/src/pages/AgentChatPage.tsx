import { useEffect, useState } from 'react';
import { MessageSquare, Users, Bot } from 'lucide-react';
import { useAgentStore } from '@/stores/agent.store';
import { useTeamStore } from '@/stores/team.store';
import { api } from '@/services/api';
import type { Message } from '@/types';

interface AgentMessage {
  id: string;
  fromAgentId: string | null;
  fromUser: boolean;
  content: string;
  type: string;
  createdAt: string;
  senderName?: string;
}

export function AgentChatPage() {
  const { agents, fetchAgents } = useAgentStore();
  const { teams, fetchTeams } = useTeamStore();
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  useEffect(() => {
    fetchAgents();
    fetchTeams();
  }, [fetchAgents, fetchTeams]);

  // Load messages for selected team or agent
  useEffect(() => {
    if (!selectedTeamId && !selectedAgentId) {
      setMessages([]);
      return;
    }

    const loadMessages = async () => {
      setIsLoadingMessages(true);
      try {
        let res;
        if (selectedTeamId) {
          res = await api.getTeamMessages(selectedTeamId, 1, 100);
        } else if (selectedAgentId) {
          res = await api.getAgentMessages(selectedAgentId, 1, 100);
        }

        const msgs = ((res?.data ?? []) as Message[]).map((m) => ({
          id: m.id,
          fromAgentId: m.fromAgentId,
          fromUser: m.fromUser,
          content: m.content,
          type: m.type,
          createdAt: m.createdAt as unknown as string,
          senderName: m.fromUser
            ? 'User'
            : agents.find((a) => a.id === m.fromAgentId)?.name ?? 'Agent',
        }));

        setMessages(msgs.reverse());
      } catch {
        setMessages([]);
      }
      setIsLoadingMessages(false);
    };

    loadMessages();
    const interval = setInterval(loadMessages, 5000);
    return () => clearInterval(interval);
  }, [selectedTeamId, selectedAgentId, agents]);

  const teamAgents = selectedTeamId
    ? agents.filter((a) => a.teamId === selectedTeamId)
    : [];

  const nonMainAgents = agents.filter((a) => !a.isMainAgent);

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      {/* Left Panel: Teams & Agents list */}
      <div className="w-72 shrink-0 overflow-y-auto rounded-xl border border-border bg-surface">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-text-primary">Conversations</h2>
        </div>

        {/* Teams section */}
        <div className="px-3 py-2">
          <p className="mb-2 px-2 text-xs font-medium uppercase text-text-secondary">Teams</p>
          {teams.length === 0 && (
            <p className="px-2 text-xs text-text-secondary">No teams yet</p>
          )}
          {teams.map((team) => (
            <button
              key={team.id}
              onClick={() => {
                setSelectedTeamId(team.id);
                setSelectedAgentId(null);
              }}
              className={`mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                selectedTeamId === team.id
                  ? 'bg-primary-600/15 text-primary-400'
                  : 'text-text-secondary hover:bg-surface-light hover:text-text-primary'
              }`}
            >
              <Users size={16} />
              <span className="truncate">{team.name}</span>
            </button>
          ))}
        </div>

        {/* Agents section */}
        <div className="border-t border-border px-3 py-2">
          <p className="mb-2 px-2 text-xs font-medium uppercase text-text-secondary">Agents</p>
          {nonMainAgents.length === 0 && (
            <p className="px-2 text-xs text-text-secondary">No agents yet</p>
          )}
          {nonMainAgents.map((agent) => (
            <button
              key={agent.id}
              onClick={() => {
                setSelectedAgentId(agent.id);
                setSelectedTeamId(null);
              }}
              className={`mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                selectedAgentId === agent.id
                  ? 'bg-primary-600/15 text-primary-400'
                  : 'text-text-secondary hover:bg-surface-light hover:text-text-primary'
              }`}
            >
              <Bot size={16} />
              <div className="min-w-0 flex-1">
                <span className="block truncate">{agent.name}</span>
                <span className="block truncate text-xs text-text-secondary">{agent.role}</span>
              </div>
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  agent.status === 'busy'
                    ? 'bg-yellow-400'
                    : agent.status === 'error'
                      ? 'bg-red-400'
                      : 'bg-green-400'
                }`}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Right Panel: Chat messages */}
      <div className="flex flex-1 flex-col rounded-xl border border-border bg-surface">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border px-5 py-3">
          {selectedTeamId ? (
            <>
              <Users size={18} className="text-primary-400" />
              <div>
                <h3 className="text-sm font-semibold text-text-primary">
                  {teams.find((t) => t.id === selectedTeamId)?.name ?? 'Team'}
                </h3>
                <p className="text-xs text-text-secondary">
                  {teamAgents.length} agent{teamAgents.length !== 1 ? 's' : ''}
                  {teamAgents.length > 0 && ` — ${teamAgents.map((a) => a.name).join(', ')}`}
                </p>
              </div>
            </>
          ) : selectedAgentId ? (
            <>
              <Bot size={18} className="text-primary-400" />
              <div>
                <h3 className="text-sm font-semibold text-text-primary">
                  {agents.find((a) => a.id === selectedAgentId)?.name ?? 'Agent'}
                </h3>
                <p className="text-xs text-text-secondary">
                  {agents.find((a) => a.id === selectedAgentId)?.role}
                </p>
              </div>
            </>
          ) : (
            <>
              <MessageSquare size={18} className="text-text-secondary" />
              <p className="text-sm text-text-secondary">
                Select a team or agent to view their conversation
              </p>
            </>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!selectedTeamId && !selectedAgentId && (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <MessageSquare size={48} className="mx-auto mb-3 text-text-secondary/30" />
                <p className="text-sm text-text-secondary">
                  Select a team or agent from the left panel to view their communications
                </p>
              </div>
            </div>
          )}

          {isLoadingMessages && (
            <p className="py-8 text-center text-sm text-text-secondary">Loading messages...</p>
          )}

          {!isLoadingMessages && (selectedTeamId || selectedAgentId) && messages.length === 0 && (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-text-secondary">No messages yet</p>
            </div>
          )}

          <div className="space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.fromUser ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[75%] rounded-xl px-4 py-2.5 ${
                    msg.fromUser
                      ? 'bg-primary-600 text-white'
                      : 'bg-surface-light text-text-primary'
                  }`}
                >
                  {!msg.fromUser && (
                    <p className="mb-1 text-xs font-semibold text-primary-400">
                      {msg.senderName}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                  <p
                    className={`mt-1 text-right text-[10px] ${
                      msg.fromUser ? 'text-white/60' : 'text-text-secondary'
                    }`}
                  >
                    {new Date(msg.createdAt).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
