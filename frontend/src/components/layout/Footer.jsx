import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin, Github, Twitter, Facebook } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { useQuery } from 'react-query';
import { statsAPI } from '../../lib/api';

const numberFormatter = new Intl.NumberFormat();
const carbonFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

const formatNumber = (value) => numberFormatter.format(Math.max(0, Math.round(value || 0)));
const formatCarbon = (value, t) => {
  const numericValue = Number(value || 0);
  if (numericValue >= 1000) {
    return `${carbonFormatter.format(numericValue / 1000)} ${t('units.t')}`;
  }
  return `${carbonFormatter.format(numericValue)} ${t('units.kg')}`;
};

export function Footer() {
  const { t } = useTranslation();
  const { data: summaryData } = useQuery(
    ['public-stats-summary'],
    async () => {
      const response = await statsAPI.getPublicSummary();
      return response.data?.data ?? null;
    },
    {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    }
  );

  const currentYear = new Date().getFullYear();
  const appVersion = useMemo(() => {
    const version = import.meta.env?.VITE_APP_VERSION;
    return typeof version === 'string' && version.trim() ? version.trim() : 'dev';
  }, []);

  const buildId = useMemo(() => {
    const normalized = (process.env?.CF_PAGES_COMMIT_SHA ?? 'dev').toString().trim();
    return normalized.length > 12 ? normalized.slice(0, 12) : normalized;
  }, []);

  const footerLinks = {
    platform: [
      { label: t('footer.about'), href: '/about-us' },
      { label: t('footer.howItWorks'), href: '/how-it-works' },
      { label: t('footer.features'), href: '/features' },
      { label: t('footer.pricing'), href: '/pricing' }
    ],
    support: [
      { label: t('footer.help'), href: '/help' },
      { label: t('footer.faq'), href: '/faq' },
      { label: t('footer.contact'), href: '/contact' },
      { label: t('footer.feedback'), href: '/feedback' }
    ],
    legal: [
      { label: t('footer.privacy'), href: '/privacy' },
      { label: t('footer.terms'), href: '/terms' },
      { label: t('footer.cookies'), href: '/cookies' },
      { label: t('footer.security'), href: '/security' }
    ]
  };

  const socialLinks = [
    { icon: Github, href: 'https://github.com', label: 'GitHub' },
    { icon: Twitter, href: 'https://twitter.com', label: 'Twitter' },
    { icon: Facebook, href: 'https://facebook.com', label: 'Facebook' }
  ];

  return (
    <footer className="bg-gray-900 text-white">
      {/* 主要内容区域 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* 品牌信息 */}
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <img src="/favicon_48x48.ico" alt="CarbonTrack logo" className="h-8 w-8" />
              <span className="text-xl font-bold">CarbonTrack</span>
            </div>
            <p className="text-gray-300 mb-6 text-sm leading-relaxed">
              {t('footer.description')}
            </p>

            {/* 联系信息 */}
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-gray-300">
                <Mail className="h-4 w-4" />
                <span>{import.meta.env.VITE_SUPPORT_EMAIL}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-300">
                <Phone className="h-4 w-4" />
                <span>+86 400-123-4567</span>
              </div>
              <div className="flex items-center gap-2 text-gray-300">
                <MapPin className="h-4 w-4" />
                <span>{t('footer.address')}</span>
              </div>
            </div>
          </div>

          {/* 平台链接 */}
          <div>
            <h3 className="text-lg font-semibold mb-4">{t('footer.platform')}</h3>
            <ul className="space-y-2">
              {footerLinks.platform.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="text-gray-300 hover:text-white transition-colors text-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* 支持链接 */}
          <div>
            <h3 className="text-lg font-semibold mb-4">{t('footer.support')}</h3>
            <ul className="space-y-2">
              {footerLinks.support.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="text-gray-300 hover:text-white transition-colors text-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* 法律链接 */}
          <div>
            <h3 className="text-lg font-semibold mb-4">{t('footer.legal')}</h3>
            <ul className="space-y-2">
              {footerLinks.legal.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="text-gray-300 hover:text-white transition-colors text-sm"
                  >
                    {link.label}
                  </Link>
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
              <span className="text-sm text-gray-300">{t('footer.followUs')}:</span>
              <div className="flex gap-3">
                {socialLinks.map((social) => {
                  const Icon = social.icon;
                  return (
                    <a
                      key={social.label}
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-white transition-colors"
                      aria-label={social.label}
                    >
                      <Icon className="h-5 w-5" />
                    </a>
                  );
                })}
              </div>
            </div>

            {/* 平台统计 */}
            <div className="flex items-center gap-6 text-sm text-gray-300">
              <div className="text-center">
                <div className="font-semibold text-white">
                  {summaryData ? formatNumber(summaryData.total_users ?? 0) : '...'}
                </div>
                <div>{t('footer.users')}</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-white">
                  {summaryData ? formatNumber(summaryData.total_records ?? 0) : '...'}
                </div>
                <div>{t('footer.activities')}</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-white">
                  {summaryData ? formatCarbon(summaryData.total_carbon_saved ?? 0, t) : '...'}
                </div>
                <div>{t('footer.carbonSaved')}</div>
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
              © {currentYear} CarbonTrack. {t('footer.allRightsReserved')}
            </div>
            <div className="flex items-center gap-4">
              <span>{t('footer.versionLabel', { version: appVersion })}</span>
              <span>•</span>
              <span>{t('footer.buildLabel', { id: buildId })}</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
