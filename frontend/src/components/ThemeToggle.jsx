import { useEffect as Silian_useEffect, useState as Silian_useState } from 'react';
import { useTheme as Silian_useTheme } from 'next-themes';
import { Sun as Silian_Sun, Moon as Silian_Moon, Laptop as Silian_Laptop } from 'lucide-react';
import { Button as Silian_Button } from './ui/Button';
import { cn as Silian_cn } from '@/lib/utils';
import {
  DropdownMenu as Silian_DropdownMenu,
  DropdownMenuContent as Silian_DropdownMenuContent,
  DropdownMenuRadioGroup as Silian_DropdownMenuRadioGroup,
  DropdownMenuRadioItem as Silian_DropdownMenuRadioItem,
  DropdownMenuTrigger as Silian_DropdownMenuTrigger,
} from './ui/dropdown-menu';

const Silian_themeOptions = [
  { value: 'light', label: 'Light', icon: Silian_Sun },
  { value: 'dark', label: 'Dark', icon: Silian_Moon },
  { value: 'system', label: 'System', icon: Silian_Laptop },
];

export function ThemeToggle({ variant: Silian_variant = 'ghost', size: Silian_size = 'icon', className: Silian_className }) {
  const { theme: Silian_theme, resolvedTheme: Silian_resolvedTheme, setTheme: Silian_setTheme } = Silian_useTheme();
  const [Silian_mounted, Silian_setMounted] = Silian_useState(false);

  Silian_useEffect(() => {
    Silian_setMounted(true);
  }, []);

  const Silian_currentTheme = Silian_theme || 'system';
  const Silian_currentOption = Silian_themeOptions.find((Silian_option) => Silian_option.value === Silian_currentTheme) || Silian_themeOptions[2];
  const Silian_CurrentIcon = Silian_mounted && Silian_currentTheme === 'system'
    ? (Silian_resolvedTheme === 'dark' ? Silian_Moon : Silian_Sun)
    : Silian_currentOption.icon;

  return (
    <Silian_DropdownMenu>
      <Silian_DropdownMenuTrigger asChild>
        <Silian_Button
          variant={Silian_variant}
          size={Silian_size}
          className={Silian_cn('relative text-muted-foreground hover:text-foreground', Silian_className)}
          aria-label={`Color theme: ${Silian_currentOption.label}`}
          disabled={!Silian_mounted}
        >
          <Silian_CurrentIcon className="h-4 w-4" />
        </Silian_Button>
      </Silian_DropdownMenuTrigger>
      <Silian_DropdownMenuContent align="end" className="min-w-[10rem]">
        <Silian_DropdownMenuRadioGroup value={Silian_currentTheme} onValueChange={Silian_setTheme}>
          {Silian_themeOptions.map((Silian_option) => {
            const Silian_Icon = Silian_option.icon;
            return (
              <Silian_DropdownMenuRadioItem key={Silian_option.value} value={Silian_option.value} className="cursor-pointer">
                <Silian_Icon className="h-4 w-4" />
                <span>{Silian_option.label}</span>
              </Silian_DropdownMenuRadioItem>
            );
          })}
        </Silian_DropdownMenuRadioGroup>
      </Silian_DropdownMenuContent>
    </Silian_DropdownMenu>
  );
}
