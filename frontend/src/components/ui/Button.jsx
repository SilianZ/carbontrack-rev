import Silian_React from 'react';
import { cn as Silian_cn } from '../../lib/cn';
import { baseButtonClasses as Silian_baseButtonClasses, buttonSizeClasses as Silian_buttonSizeClasses, buttonVariantClasses as Silian_buttonVariantClasses } from './button-variants';

const Silian_Button = Silian_React.forwardRef(({
  className: Silian_className,
  variant: Silian_variant = "default",
  size: Silian_size = "default",
  loading: Silian_loading = false,
  children: Silian_children,
  disabled: Silian_disabled,
  ...Silian_props
}, Silian_ref) => {
  return (
    <button
      className={Silian_cn(
  Silian_baseButtonClasses,
  Silian_buttonVariantClasses[Silian_variant],
  Silian_buttonSizeClasses[Silian_size],
        Silian_className
      )}
      ref={Silian_ref}
      disabled={Silian_disabled || Silian_loading}
      {...Silian_props}
    >
      {Silian_loading && (
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
      {Silian_children}
    </button>
  );
});

Silian_Button.displayName = "Button";

export { Silian_Button as Button };
