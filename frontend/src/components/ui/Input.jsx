import Silian_React from 'react';
import { cn as Silian_cn } from '../../lib/utils';

const Silian_Input = Silian_React.forwardRef(({ className: Silian_className, type: Silian_type, error: Silian_error, ...Silian_props }, Silian_ref) => {
  return (
    <input
      type={Silian_type}
      className={Silian_cn(
        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        Silian_error && "border-red-500 focus-visible:ring-red-500",
        Silian_className
      )}
      ref={Silian_ref}
      {...Silian_props}
    />
  );
});

Silian_Input.displayName = "Input";

export { Silian_Input as Input };

