import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Globe, Check } from 'lucide-react';
import { supportedLanguages, changeLanguage, getCurrentLanguage } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const LanguageSwitcher = ({ variant = 'default', size = 'default', showText = true, className }) => {
  // i18n instance is initialized globally; we don't use t() here directly.
  useTranslation();
  const [isChanging, setIsChanging] = useState(false);
  const currentLanguage = getCurrentLanguage();

  const handleLanguageChange = async (lng) => {
    if (lng === currentLanguage || isChanging) return;
    
    setIsChanging(true);
    try {
      await changeLanguage(lng);
    } catch (error) {
      console.error('Failed to change language:', error);
    } finally {
      setIsChanging(false);
    }
  };

  const currentLangInfo = supportedLanguages[currentLanguage];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant={variant} 
          size={size}
          disabled={isChanging}
          className={cn('gap-2', className)}
        >
          <Globe className="h-4 w-4" />
          {showText && (
            <span className="hidden sm:inline">
              {currentLangInfo?.nativeName || currentLanguage.toUpperCase()}
            </span>
          )}
          <span className="sm:hidden">
            {currentLangInfo?.flag || '🌐'}
          </span>
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="min-w-[150px]">
        {Object.entries(supportedLanguages).map(([lng, info]) => (
          <DropdownMenuItem
            key={lng}
            onClick={() => handleLanguageChange(lng)}
            className="flex items-center justify-between cursor-pointer"
            disabled={isChanging}
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">{info.flag}</span>
              <span>{info.nativeName}</span>
            </div>
            {lng === currentLanguage && (
              <Check className="h-4 w-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default LanguageSwitcher;
