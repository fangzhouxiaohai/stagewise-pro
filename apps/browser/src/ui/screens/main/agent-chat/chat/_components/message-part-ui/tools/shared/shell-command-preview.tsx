import { cn } from '@ui/utils';
import type { ReactNode } from 'react';

export function ShellCommandPreview({
  children,
  className,
  output,
  prefix = '$',
}: {
  children: ReactNode;
  className?: string;
  output?: string | null;
  prefix?: '$' | '→';
}) {
  return (
    // 命令与输出都是原始数据，不参与界面翻译（例如输出恰好是 "Done"）。
    <div data-i18n-skip className={cn('px-2 py-1', className)}>
      <div
        className={cn(
          'whitespace-pre-wrap break-all pb-1 font-mono text-muted-foreground text-xs',
          output && 'pb-4',
        )}
      >
        <span className="select-none text-subtle-foreground">{prefix} </span>
        {children}
      </div>
      {output ? (
        <div className="mt-1 whitespace-pre-wrap break-all font-mono font-normal text-subtle-foreground text-xs">
          {output}
        </div>
      ) : null}
    </div>
  );
}
