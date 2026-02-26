import { useState } from 'react';
import { Bot } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';

export function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const { login, register, isLoading } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (isRegister) {
        await register(email, password, name);
      } else {
        await login(email, password);
      }
    } catch (err) {
      setError((err as Error).message || 'Authentication failed');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-600 shadow-lg shadow-primary-600/25">
            <Bot size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary">Workspace AI</h1>
          <p className="mt-1 text-sm text-text-secondary">Multi-Agent Orchestration Platform</p>
        </div>

        {/* Form */}
        <div className="rounded-xl border border-border bg-surface p-6 shadow-xl">
          <h2 className="mb-6 text-center text-lg font-semibold text-text-primary">
            {isRegister ? 'Create Account' : 'Sign In'}
          </h2>

          {error && (
            <div className="mb-4 rounded-lg bg-red-600/10 px-4 py-2.5 text-sm text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <div>
                <label className="mb-1 block text-sm font-medium text-text-primary">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full rounded-lg border border-border bg-bg px-4 py-2.5 text-sm text-text-primary placeholder-text-secondary outline-none focus:border-primary-500"
                  required
                />
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-text-primary">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-border bg-bg px-4 py-2.5 text-sm text-text-primary placeholder-text-secondary outline-none focus:border-primary-500"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-text-primary">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 8 characters"
                className="w-full rounded-lg border border-border bg-bg px-4 py-2.5 text-sm text-text-primary placeholder-text-secondary outline-none focus:border-primary-500"
                required
                minLength={8}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-lg bg-primary-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
            >
              {isLoading ? 'Loading...' : isRegister ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-text-secondary">
            {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              onClick={() => {
                setIsRegister(!isRegister);
                setError('');
              }}
              className="font-medium text-primary-400 hover:text-primary-300"
            >
              {isRegister ? 'Sign In' : 'Register'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
