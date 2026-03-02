import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StarRatingProps {
  value: number;
  onChange?: (v: number) => void;
  max?: number;
  size?: 'sm' | 'md';
}

export function StarRating({ value, onChange, max = 5, size = 'sm' }: StarRatingProps) {
  const sz = size === 'sm' ? 'h-3.5 w-3.5' : 'h-5 w-5';
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange?.(i + 1)}
          disabled={!onChange}
          className={cn('transition-colors', onChange ? 'cursor-pointer' : 'cursor-default')}
        >
          <Star className={cn(sz, i < value ? 'fill-accent text-accent' : 'text-muted-foreground/30')} />
        </button>
      ))}
    </div>
  );
}
