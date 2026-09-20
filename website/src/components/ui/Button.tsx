import Link from 'next/link';
import { ReactNode } from 'react';

type Props = {
  href?: string;
  children: ReactNode;
  variant?: 'primary' | 'gold' | 'ghost' | 'ghost-dark';
  type?: 'button' | 'submit';
  disabled?: boolean;
  className?: string;
  onClick?: () => void;
};

export function Button({
  href,
  children,
  variant = 'primary',
  type = 'button',
  disabled,
  className = '',
  onClick,
}: Props) {
  const classes = `btn btn--${variant} ${className}`.trim();
  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} className={classes} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}
