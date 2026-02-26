import { useEffect } from 'react';
import { ChatInterface } from '@/components/chat/ChatInterface';
import { SessionSidebar } from '@/components/chat/SessionSidebar';
import { CanvasPanel } from '@/components/canvas/CanvasPanel';
import { useAgentStore } from '@/stores/agent.store';
import { useCanvasStore } from '@/stores/canvas.store';

export function ChatPage() {
  const { mainAgent, fetchMainAgent } = useAgentStore();
  const isCanvasOpen = useCanvasStore((s) => s.isOpen);

  useEffect(() => {
    if (!mainAgent) fetchMainAgent();
  }, [mainAgent, fetchMainAgent]);

  return (
    <div className="flex h-[calc(100vh-8rem)]">
      <SessionSidebar />
      <div className="flex-1 min-w-0">
        <ChatInterface />
      </div>
      {isCanvasOpen && <CanvasPanel />}
    </div>
  );
}
