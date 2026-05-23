import { cn as Silian_cn } from '../../lib/cn';

const Silian_baseButtonClasses = 'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

const Silian_buttonVariantClasses = {
  default: 'bg-primary text-primary-foreground hover:bg-primary/90',
  destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
  outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
  ghost: 'hover:bg-accent hover:text-accent-foreground',
  link: 'text-primary underline-offset-4 hover:underline',
};

const Silian_buttonSizeClasses = {
  default: 'h-10 px-4 py-2',
  sm: 'h-9 rounded-md px-3',
  lg: 'h-11 rounded-md px-8',
  icon: 'h-10 w-10',
};

function Silian_buttonVariants(Silian_options = {}) {
  const { variant: Silian_variant = 'default', size: Silian_size = 'default', className: Silian_className } = Silian_options;
  return Silian_cn(Silian_baseButtonClasses, Silian_buttonVariantClasses[Silian_variant], Silian_buttonSizeClasses[Silian_size], Silian_className);
}

export {
  Silian_baseButtonClasses as baseButtonClasses,
  Silian_buttonVariantClasses as buttonVariantClasses,
  Silian_buttonSizeClasses as buttonSizeClasses,
  Silian_buttonVariants as buttonVariants,
};
