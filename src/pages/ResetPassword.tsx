import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Activity, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export default function ResetPassword() {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // Check for recovery token in URL hash
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.includes('type=recovery')) {
      toast.error('Invalid or expired reset link');
      navigate('/');
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await updatePassword(password);
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      setDone(true);
      toast.success('Password updated successfully');
      setTimeout(() => navigate('/'), 2000);
    }
  };

  const inputClass = "w-full bg-muted/50 border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Activity className="h-8 w-8 text-accent" />
            <span className="text-2xl font-bold text-foreground tracking-tight">TransitionIQ</span>
          </div>
          <p className="text-sm text-muted-foreground">Set your new password</p>
        </div>

        {done ? (
          <div className="text-center space-y-3">
            <CheckCircle2 className="h-12 w-12 text-status-ahead mx-auto" />
            <p className="text-sm text-foreground">Password updated! Redirecting...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">New Password</label>
              <input type="password" required minLength={6} className={inputClass} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full px-4 py-2.5 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/80 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Update Password
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
