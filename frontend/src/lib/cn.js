import { clsx as Silian_clsx } from 'clsx';
import { twMerge as Silian_twMerge } from 'tailwind-merge';

export function cn(...Silian_inputs) {
  return Silian_twMerge(Silian_clsx(Silian_inputs));
}

export default cn;
