import React from 'react';
import { cn } from '../../lib/utils';
import { baseButtonClasses, buttonSizeClasses, buttonVariantClasses } from './button-variants';

const Button = React.forwardRef(({ 
  className, 
  variant = "default", 
  size = "default", 
  loading = false,
  children,
  disabled,
  ...props 
}, ref) => {
  return (
    <button
      className={cn(
  baseButtonClasses,
  buttonVariantClasses[variant],
  buttonSizeClasses[size],
        className
      )}
      ref={ref}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg
          className="mr-2 h-4 w-4 animate-spin"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {children}
    </button>
  );
});

Button.displayName = "Button";

export { Button };

