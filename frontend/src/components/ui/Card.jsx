import Silian_React from 'react';
import { cn as Silian_cn } from '../../lib/utils';

const Silian_Card = Silian_React.forwardRef(({ className: Silian_className, ...Silian_props }, Silian_ref) => (
  <div
    ref={Silian_ref}
    className={Silian_cn(
      "rounded-2xl border border-black/5 bg-card text-card-foreground shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:bg-white/5 dark:border-white/10 dark:shadow-none dark:hover:bg-white/10 dark:backdrop-blur-md",
      Silian_className
    )}
    {...Silian_props}
  />
));
Silian_Card.displayName = "Card";

const Silian_CardHeader = Silian_React.forwardRef(({ className: Silian_className, ...Silian_props }, Silian_ref) => (
  <div
    ref={Silian_ref}
    className={Silian_cn("flex flex-col space-y-1.5 p-6", Silian_className)}
    {...Silian_props}
  />
));
Silian_CardHeader.displayName = "CardHeader";

const Silian_CardTitle = Silian_React.forwardRef(({ className: Silian_className, ...Silian_props }, Silian_ref) => (
  <h3
    ref={Silian_ref}
    className={Silian_cn(
      "text-2xl font-semibold leading-none tracking-tight",
      Silian_className
    )}
    {...Silian_props}
  />
));
Silian_CardTitle.displayName = "CardTitle";

const Silian_CardDescription = Silian_React.forwardRef(({ className: Silian_className, ...Silian_props }, Silian_ref) => (
  <p
    ref={Silian_ref}
    className={Silian_cn("text-sm text-muted-foreground", Silian_className)}
    {...Silian_props}
  />
));
Silian_CardDescription.displayName = "CardDescription";

const Silian_CardContent = Silian_React.forwardRef(({ className: Silian_className, ...Silian_props }, Silian_ref) => (
  <div ref={Silian_ref} className={Silian_cn("p-6 pt-0", Silian_className)} {...Silian_props} />
));
Silian_CardContent.displayName = "CardContent";

const Silian_CardFooter = Silian_React.forwardRef(({ className: Silian_className, ...Silian_props }, Silian_ref) => (
  <div
    ref={Silian_ref}
    className={Silian_cn("flex items-center p-6 pt-0", Silian_className)}
    {...Silian_props}
  />
));
Silian_CardFooter.displayName = "CardFooter";

export { Silian_Card as Card, Silian_CardHeader as CardHeader, Silian_CardFooter as CardFooter, Silian_CardTitle as CardTitle, Silian_CardDescription as CardDescription, Silian_CardContent as CardContent };

