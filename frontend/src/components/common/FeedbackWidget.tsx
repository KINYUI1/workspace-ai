import { useState, useRef, useEffect } from 'react';
import { MessageSquarePlus, Bug, Lightbulb, Sparkles, MessageCircle, Star, Send, X } from 'lucide-react';
import { clsx } from 'clsx';
import { api } from '@/services/api';
import { toast } from '@/components/common/Toast';

const TYPES = [
  { value: 'bug', label: 'Bug', icon: Bug, color: 'text-red-400 bg-red-500/10 border-red-500/30' },
  { value: 'feature', label: 'Feature', icon: Lightbulb, color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' },
  { value: 'improvement', label: 'Improvement', icon: Sparkles, color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  { value: 'general', label: 'General', icon: MessageCircle, color: 'text-green-400 bg-green-500/10 border-green-500/30' },
] as const;

export function FeedbackWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState<string>('general');
  const [rating, setRating] = useState<number>(0);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  const reset = () => {
    setType('general');
    setRating(0);
    setMessage('');
  };

  const handleSubmit = async () => {
    if (!message.trim()) return;
    setSubmitting(true);
    try {
      await api.createFeedback({
        type,
        rating: rating > 0 ? rating : undefined,
        message: message.trim(),
        metadata: {
          page: window.location.pathname,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
        },
      });
      toast.success('Feedback submitted! Thank you.');
      reset();
      setIsOpen(false);
    } catch {
      toast.error('Failed to submit feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed bottom-20 right-4 z-[90]" ref={panelRef}>
      {/* Floating trigger button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-600 text-white shadow-lg transition-transform hover:scale-105 hover:bg-primary-700"
          aria-label="Send feedback"
        >
          <MessageSquarePlus size={20} />
        </button>
      )}

      {/* Feedback panel */}
      {isOpen && (
        <div className="w-80 rounded-xl border border-border bg-surface shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold text-text-primary">Send Feedback</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded p-1 text-text-secondary hover:bg-surface-light hover:text-text-primary"
            >
              <X size={14} />
            </button>
          </div>

          <div className="space-y-4 p-4">
            {/* Type selector */}
            <div>
              <label className="mb-2 block text-xs font-medium text-text-secondary">Type</label>
              <div className="grid grid-cols-4 gap-2">
                {TYPES.map((t) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.value}
                      onClick={() => setType(t.value)}
                      className={clsx(
                        'flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-[10px] font-medium transition-colors',
                        type === t.value ? t.color : 'border-border text-text-secondary hover:bg-surface-light',
                      )}
                    >
                      <Icon size={16} />
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Rating */}
            <div>
              <label className="mb-2 block text-xs font-medium text-text-secondary">Rating (optional)</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((v) => (
                  <button
                    key={v}
                    onClick={() => setRating(rating === v ? 0 : v)}
                    className="rounded p-0.5 transition-colors hover:scale-110"
                  >
                    <Star
                      size={20}
                      className={clsx(
                        v <= rating ? 'fill-amber-400 text-amber-400' : 'text-text-secondary/40',
                      )}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Message */}
            <div>
              <label className="mb-2 block text-xs font-medium text-text-secondary">Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us what's on your mind..."
                rows={3}
                className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/60 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={!message.trim() || submitting}
              className={clsx(
                'flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                message.trim() && !submitting
                  ? 'bg-primary-600 text-white hover:bg-primary-700'
                  : 'bg-surface-light text-text-secondary cursor-not-allowed',
              )}
            >
              <Send size={14} />
              {submitting ? 'Submitting...' : 'Submit Feedback'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
