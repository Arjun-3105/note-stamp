import React, { HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  interactive?: boolean;
}

export const Card: React.FC<CardProps> = ({ 
  children, 
  className = '',
  padding = 'md',
  interactive = false,
  ...props
}) => {
  const paddingClasses: Record<NonNullable<CardProps["padding"]>, string> = {
    none: "p-0",
    sm: "p-3",
    md: "p-4",
    lg: "p-6",
  };

  return (
    <div
      className={[
        "rounded-2xl border border-white/10 bg-[#0b1324] shadow-[0_20px_60px_rgba(2,8,23,0.35)]",
        paddingClasses[padding],
        interactive ? "transition hover:-translate-y-0.5 hover:border-cyan-400/40 hover:shadow-[0_20px_60px_rgba(8,145,178,0.2)]" : "",
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </div>
  );
};

