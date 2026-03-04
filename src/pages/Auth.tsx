import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Activity, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function Auth() {
  const { signIn, signUp, resetPassword } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');

  const inputClass = "w-full bg-muted/50 border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === 'forgot') {
        const { error } = await resetPassword(email);
        if (error) throw error;
        toast.success('Password reset email sent. Check your inbox.');
        setMode('login');
      } else if (mode === 'signup') {
        const { error } = await signUp(email, password, fullName);
        if (error) throw error;
        toast.success('Account created! Check your email to verify your account.');
        setMode('login');
      } else {
        const { error } = await signIn(email, password);
        if (error) throw error;
      }
    } catch (err: any) {
      toast.error(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Activity className="h-8 w-8 text-accent" />
            <span className="text-2xl font-bold text-foreground tracking-tight">TransitionIQ</span>
          </div>
          <p className="text-sm text-muted-foreground">
            {mode === 'login' ? 'Sign in to your account' : mode === 'signup' ? 'Create your account' : 'Reset your password'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Full Name</label>
              <input className={inputClass} value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your name" />
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Email</label>
            <input type="email" required className={inputClass} value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          {mode !== 'forgot' && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Password</label>
              <input type="password" required minLength={6} className={inputClass} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
          )}
          <button type="submit" disabled={loading}
            className="w-full px-4 py-2.5 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/80 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === 'login' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send Reset Link'}
          </button>
        </form>

        <div className="text-center space-y-2">
          {mode === 'login' && (
            <>
              <button onClick={() => setMode('forgot')} className="text-xs text-muted-foreground hover:text-accent transition-colors">
                Forgot password?
              </button>
              <p className="text-xs text-muted-foreground">
                Don't have an account?{' '}
                <button onClick={() => setMode('signup')} className="text-accent hover:underline">Sign up</button>
              </p>
            </>
          )}
          {mode === 'signup' && (
            <p className="text-xs text-muted-foreground">
              Already have an account?{' '}
              <button onClick={() => setMode('login')} className="text-accent hover:underline">Sign in</button>
            </p>
          )}
          {mode === 'forgot' && (
            <button onClick={() => setMode('login')} className="text-xs text-accent hover:underline">
              Back to sign in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
