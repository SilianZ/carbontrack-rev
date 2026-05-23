import Silian_React from 'react';
import { cn as Silian_cn } from '../../lib/utils';

const Silian_alertVariants = {
  default: "bg-background text-foreground",
  destructive: "border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive",
  success: "border-green-500/50 text-green-700 dark:border-green-500 [&>svg]:text-green-700",
  warning: "border-yellow-500/50 text-yellow-700 dark:border-yellow-500 [&>svg]:text-yellow-700",
  info: "border-blue-500/50 text-blue-700 dark:border-blue-500 [&>svg]:text-blue-700"
};

const Silian_Alert = Silian_React.forwardRef(({ className: Silian_className, variant: Silian_variant = "default", ...Silian_props }, Silian_ref) => (
  <div
    ref={Silian_ref}
    role="alert"
    className={Silian_cn(
      "relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground",
      Silian_alertVariants[Silian_variant],
      Silian_className
    )}
    {...Silian_props}
  />
));
Silian_Alert.displayName = "Alert";

const Silian_AlertTitle = Silian_React.forwardRef(({ className: Silian_className, ...Silian_props }, Silian_ref) => (
  <h5
    ref={Silian_ref}
    className={Silian_cn("mb-1 font-medium leading-none tracking-tight", Silian_className)}
    {...Silian_props}
  />
));
Silian_AlertTitle.displayName = "AlertTitle";

const Silian_AlertDescription = Silian_React.forwardRef(({ className: Silian_className, ...Silian_props }, Silian_ref) => (
  <div
    ref={Silian_ref}
    className={Silian_cn("text-sm [&_p]:leading-relaxed", Silian_className)}
    {...Silian_props}
  />
));
Silian_AlertDescription.displayName = "AlertDescription";

export { Silian_Alert as Alert, Silian_AlertTitle as AlertTitle, Silian_AlertDescription as AlertDescription };

