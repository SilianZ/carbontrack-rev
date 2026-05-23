import Silian_React, { useMemo as Silian_useMemo } from 'react';
import { Link as Silian_Link } from 'react-router-dom';
import { Mail as Silian_Mail, Phone as Silian_Phone, MapPin as Silian_MapPin, Github as Silian_Github, Twitter as Silian_Twitter, Facebook as Silian_Facebook } from 'lucide-react';
import { useTranslation as Silian_useTranslation } from '../../hooks/useTranslation';
import { useQuery as Silian_useQuery } from 'react-query';
import { statsAPI as Silian_statsAPI } from '../../lib/api';

const Silian_numberFormatter = new Intl.NumberFormat();
const Silian_carbonFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

const Silian_formatNumber = (Silian_value) => Silian_numberFormatter.format(Math.max(0, Math.round(Silian_value || 0)));
const Silian_formatCarbon = (Silian_value, Silian_t) => {
  const Silian_numericValue = Number(Silian_value || 0);
  if (Silian_numericValue >= 1000) {
    return `${Silian_carbonFormatter.format(Silian_numericValue / 1000)} ${Silian_t('units.t')}`;
  }
  return `${Silian_carbonFormatter.format(Silian_numericValue)} ${Silian_t('units.kg')}`;
};

export function Footer({ summaryData: Silian_summaryData = null, enableLiveSummary: Silian_enableLiveSummary = true }) {
  const { t: Silian_t } = Silian_useTranslation(['footer', 'units']);
  const { data: Silian_liveSummaryData } = Silian_useQuery(
    ['public-stats-summary'],
    async () => {
      const Silian_response = await Silian_statsAPI.getPublicSummary();
      return Silian_response.data?.data ?? null;
    },
    {
      enabled: Silian_enableLiveSummary && Silian_summaryData == null,
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    }
  );
  const Silian_effectiveSummaryData = Silian_summaryData ?? Silian_liveSummaryData ?? null;

  const Silian_currentYear = new Date().getFullYear();
  const Silian_appVersion = Silian_useMemo(() => {
    const Silian_version = import.meta.env?.VITE_APP_VERSION;
    return typeof Silian_version === 'string' && Silian_version.trim() ? Silian_version.trim() : 'dev';
  }, []);

  const Silian_buildId = Silian_useMemo(() => {
    const Silian_normalized = (import.meta.env?.VITE_BUILD_ID ?? 'dev').toString().trim();
    return Silian_normalized.length > 12 ? Silian_normalized.slice(0, 12) : Silian_normalized;
  }, []);

  const Silian_footerLinks = {
    platform: [
      { label: Silian_t('footer.about'), href: '/about-us' },
      { label: Silian_t('footer.howItWorks'), href: '/how-it-works' },
      { label: Silian_t('footer.features'), href: '/features' },
      { label: Silian_t('footer.pricing'), href: '/pricing' }
    ],
    support: [
      { label: Silian_t('footer.help'), href: '/help' },
      { label: Silian_t('footer.faq'), href: '/faq' },
      { label: Silian_t('footer.contact'), href: '/contact' },
      { label: Silian_t('footer.feedback'), href: '/feedback' }
    ],
    legal: [
      { label: Silian_t('footer.privacy'), href: '/privacy' },
      { label: Silian_t('footer.terms'), href: '/terms' },
      { label: Silian_t('footer.cookies'), href: '/cookies' },
      { label: Silian_t('footer.security'), href: '/security' }
    ]
  };

  const Silian_socialLinks = [
    { icon: Silian_Github, href: 'https://github.com', label: 'GitHub' },
    { icon: Silian_Twitter, href: 'https://twitter.com', label: 'Twitter' },
    { icon: Silian_Facebook, href: 'https://facebook.com', label: 'Facebook' }
  ];

  return (
    <footer className="bg-gray-900 text-white">
      {/* 主要内容区域 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* 品牌信息 */}
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <img src="/favicon.ico" alt="CarbonTrack logo" className="h-8 w-8" />
              <span className="text-xl font-bold">CarbonTrack</span>
            </div>
            <p className="text-gray-300 mb-6 text-sm leading-relaxed">
              {Silian_t('footer.description')}
            </p>

            {/* 联系信息 */}
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-gray-300">
                <Silian_Mail className="h-4 w-4" />
                <span>{import.meta.env.VITE_SUPPORT_EMAIL}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-300">
                <Silian_Phone className="h-4 w-4" />
                <span>+1 475-280-7571</span>
              </div>
              <div className="flex items-center gap-2 text-gray-300">
                <Silian_MapPin className="h-4 w-4" />
                <span>{Silian_t('footer.address')}</span>
              </div>
            </div>
          </div>

          {/* 平台链接 */}
          <div>
            <h3 className="text-lg font-semibold mb-4">{Silian_t('footer.platform')}</h3>
            <ul className="space-y-2">
              {Silian_footerLinks.platform.map((Silian_link) => (
                <li key={Silian_link.href}>
                  <Silian_Link
                    to={Silian_link.href}
                    className="text-gray-300 hover:text-white transition-colors text-sm"
                  >
                    {Silian_link.label}
                  </Silian_Link>
                </li>
              ))}
            </ul>
          </div>

          {/* 支持链接 */}
          <div>
            <h3 className="text-lg font-semibold mb-4">{Silian_t('footer.support')}</h3>
            <ul className="space-y-2">
              {Silian_footerLinks.support.map((Silian_link) => (
                <li key={Silian_link.href}>
                  <Silian_Link
                    to={Silian_link.href}
                    className="text-gray-300 hover:text-white transition-colors text-sm"
                  >
                    {Silian_link.label}
                  </Silian_Link>
                </li>
              ))}
            </ul>
          </div>

          {/* 法律链接 */}
          <div>
            <h3 className="text-lg font-semibold mb-4">{Silian_t('footer.legal')}</h3>
            <ul className="space-y-2">
              {Silian_footerLinks.legal.map((Silian_link) => (
                <li key={Silian_link.href}>
                  <Silian_Link
                    to={Silian_link.href}
                    className="text-gray-300 hover:text-white transition-colors text-sm"
                  >
                    {Silian_link.label}
                  </Silian_Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* 社交媒体和统计信息 */}
        <div className="mt-12 pt-8 border-t border-gray-800">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            {/* 社交媒体链接 */}
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-300">{Silian_t('footer.followUs')}:</span>
              <div className="flex gap-3">
                {Silian_socialLinks.map((Silian_social) => {
                  const Silian_Icon = Silian_social.icon;
                  return (
                    <a
                      key={Silian_social.label}
                      href={Silian_social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-white transition-colors"
                      aria-label={Silian_social.label}
                    >
                      <Silian_Icon className="h-5 w-5" />
                    </a>
                  );
                })}
              </div>
            </div>

            {/* 平台统计 */}
            <div className="flex items-center gap-6 text-sm text-gray-300">
              <div className="text-center">
                <div className="font-semibold text-white">
                  {Silian_effectiveSummaryData ? Silian_formatNumber(Silian_effectiveSummaryData.total_users ?? 0) : '...'}
                </div>
                <div>{Silian_t('footer.users')}</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-white">
                  {Silian_effectiveSummaryData ? Silian_formatNumber(Silian_effectiveSummaryData.total_records ?? 0) : '...'}
                </div>
                <div>{Silian_t('footer.activities')}</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-white">
                  {Silian_effectiveSummaryData ? Silian_formatCarbon(Silian_effectiveSummaryData.total_carbon_saved ?? 0, Silian_t) : '...'}
                </div>
                <div>{Silian_t('footer.carbonSaved')}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 版权信息 */}
      <div className="bg-gray-950 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-2 text-sm text-gray-400">
            <div>
              © {Silian_currentYear} CarbonTrack. {Silian_t('footer.allRightsReserved')}
            </div>
            <div className="flex items-center gap-4">
              <span>{Silian_t('footer.versionLabel', { version: Silian_appVersion })}</span>
              <span>•</span>
              <span>{Silian_t('footer.buildLabel', { id: Silian_buildId })}</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
