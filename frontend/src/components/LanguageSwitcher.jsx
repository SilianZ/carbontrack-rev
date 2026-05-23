import { useState as Silian_useState } from 'react';
import { useTranslation as Silian_useTranslation } from 'react-i18next';
import { Button as Silian_Button } from '@/components/ui/Button';
import {
  DropdownMenu as Silian_DropdownMenu,
  DropdownMenuContent as Silian_DropdownMenuContent,
  DropdownMenuItem as Silian_DropdownMenuItem,
  DropdownMenuTrigger as Silian_DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Globe as Silian_Globe, Check as Silian_Check } from 'lucide-react';
import { supportedLanguages as Silian_supportedLanguages, changeLanguage as Silian_changeLanguage, getCurrentLanguage as Silian_getCurrentLanguage } from '@/lib/i18n';
import { cn as Silian_cn } from '@/lib/utils';

const Silian_LanguageSwitcher = ({ variant: Silian_variant = 'default', size: Silian_size = 'default', showText: Silian_showText = true, className: Silian_className }) => {
  // i18n instance is initialized globally; we don't use t() here directly.
  Silian_useTranslation(['common']);
  const [Silian_isChanging, Silian_setIsChanging] = Silian_useState(false);
  const Silian_currentLanguage = Silian_getCurrentLanguage();

  const Silian_handleLanguageChange = async (Silian_lng) => {
    if (Silian_lng === Silian_currentLanguage || Silian_isChanging) return;

    Silian_setIsChanging(true);
    try {
      await Silian_changeLanguage(Silian_lng);
    } catch (Silian_error) {
      console.error('Failed to change language:', Silian_error);
    } finally {
      Silian_setIsChanging(false);
    }
  };

  const Silian_currentLangInfo = Silian_supportedLanguages[Silian_currentLanguage];

  return (
    <Silian_DropdownMenu>
      <Silian_DropdownMenuTrigger asChild>
        <Silian_Button
          variant={Silian_variant}
          size={Silian_size}
          disabled={Silian_isChanging}
          className={Silian_cn('gap-2', Silian_className)}
        >
          <Silian_Globe className="h-4 w-4" />
          {Silian_showText && (
            <span className="hidden sm:inline">
              {Silian_currentLangInfo?.nativeName || Silian_currentLanguage.toUpperCase()}
            </span>
          )}
          <span className="sm:hidden">
            {Silian_currentLangInfo?.flag || '🌐'}
          </span>
        </Silian_Button>
      </Silian_DropdownMenuTrigger>

      <Silian_DropdownMenuContent align="end" className="min-w-[150px]">
        {Object.entries(Silian_supportedLanguages).map(([Silian_lng, Silian_info]) => (
          <Silian_DropdownMenuItem
            key={Silian_lng}
            onClick={() => Silian_handleLanguageChange(Silian_lng)}
            className="flex items-center justify-between cursor-pointer"
            disabled={Silian_isChanging}
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">{Silian_info.flag}</span>
              <span>{Silian_info.nativeName}</span>
            </div>
            {Silian_lng === Silian_currentLanguage && (
              <Silian_Check className="h-4 w-4 text-primary" />
            )}
          </Silian_DropdownMenuItem>
        ))}
      </Silian_DropdownMenuContent>
    </Silian_DropdownMenu>
  );
};

export default Silian_LanguageSwitcher;
