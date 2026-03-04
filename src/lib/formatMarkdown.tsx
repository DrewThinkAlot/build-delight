import React from 'react';

/** Simple inline markdown: bold and bullet formatting */
export function formatMarkdown(text: string): React.ReactNode {
  if (!text.trim()) return null;
  const lines = text.split('\n');
  return lines.map((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g).map((seg, j) => {
      if (seg.startsWith('**') && seg.endsWith('**')) {
        return <strong key={j} className="text-foreground font-semibold">{seg.slice(2, -2)}</strong>;
      }
      return seg;
    });

    const bulletMatch = line.match(/^(\s*)[-•]\s/);
    if (bulletMatch) {
      const indent = bulletMatch[1].length;
      return (
        <div key={i} className="flex gap-1.5" style={{ paddingLeft: `${indent * 8 + 4}px` }}>
          <span className="text-accent mt-0.5 shrink-0">•</span>
          <span>{parts}</span>
        </div>
      );
    }

    return <p key={i} className={line.trim() === '' ? 'h-2' : ''}>{parts}</p>;
  });
}
