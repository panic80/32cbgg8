import { ReactNode, UIEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import LogoImage from '@/components/LogoImage';

import '@/styles/landing.css';
import '@/styles/sticky-footer.css';
import { SITE_CONFIG } from '@/constants/siteConfig';
import { useTheme } from '@/context/ThemeContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FeatureCard } from '@/components/ui/feature-card';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { LocaleToggle } from '@/components/LocaleToggle';
import { useLocale } from '@/i18n/LocaleContext';
import { landingCopy } from '@/i18n/landingCopy';
import { cn } from '@/lib/utils';
import { footerLinks, getLandingFeatures } from './landingConfig';

type ModalType = 'privacy' | 'about' | 'scip' | null;

interface ScrollableModalProps {
  children: ReactNode;
  showScrollIndicator: boolean;
  onScroll: (event: UIEvent<HTMLDivElement>) => void;
  contentClassName?: string;
}

function ScrollableModal({
  children,
  showScrollIndicator,
  onScroll,
  contentClassName,
}: ScrollableModalProps): JSX.Element {
  return (
    <div className="relative">
      <div
        className={cn('overflow-y-auto max-h-[60vh] pr-2', contentClassName)}
        onScroll={onScroll}
      >
        {children}
      </div>
      {showScrollIndicator && (
        <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-[var(--background)] to-transparent pointer-events-none flex items-end justify-center pb-2">
          <ChevronDown className="w-5 h-5 text-[var(--primary)] animate-bounce" />
        </div>
      )}
    </div>
  );
}

const CLOSE_BUTTON_CLASS =
  'min-h-11 w-full px-4 py-2 sm:py-3 text-center text-sm sm:text-base text-[var(--text)] bg-[var(--card)] hover:bg-[var(--primary)] hover:text-white rounded-lg transition-colors duration-300';

const SCIP_NAVIGATION_DELAY_MS = 150;

const formatFooterCopy = (template: string, values: Record<string, string>) =>
  Object.entries(values).reduce(
    (formatted, [key, value]) => formatted.replace(`{${key}}`, value),
    template,
  );

const formatLastUpdatedDate = (locale: 'en' | 'fr') => {
  if (locale === 'en') return SITE_CONFIG.LAST_UPDATED;

  return new Intl.DateTimeFormat('fr-CA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(SITE_CONFIG.LAST_UPDATED));
};

function LandingPage(): JSX.Element {
  const { theme, toggleTheme } = useTheme();
  const { locale } = useLocale();
  const copy = landingCopy[locale];
  const landingFeatures = getLandingFeatures(locale);
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [isNavigatingToSCIP, setIsNavigatingToSCIP] = useState(false);
  const [privacyScrollIndicator, setPrivacyScrollIndicator] = useState(true);
  const [aboutScrollIndicator, setAboutScrollIndicator] = useState(true);
  const scipNavigationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (scipNavigationTimerRef.current !== null) {
        clearTimeout(scipNavigationTimerRef.current);
      }
    };
  }, []);

  const { isCopied: isLinkCopied, handleCopy: copySCIPLink } = useCopyToClipboard({
    text: SITE_CONFIG.SCIP_PORTAL_URL,
    copyMessage: copy.copyLinkStatus.copied,
    copyErrorMessage: copy.copyLinkStatus.failed,
  });

  const closeModal = useCallback(() => setActiveModal(null), []);

  const handleScrollCheck = useCallback(
    (event: UIEvent<HTMLDivElement>, setIndicator: (value: boolean) => void) => {
      const element = event.currentTarget;
      const isAtBottom = element.scrollHeight - element.scrollTop <= element.clientHeight + 10;
      setIndicator(!isAtBottom);
    },
    [],
  );

  const confirmSCIPNavigation = useCallback(() => {
    if (isNavigatingToSCIP || scipNavigationTimerRef.current !== null) return;
    setIsNavigatingToSCIP(true);
    scipNavigationTimerRef.current = setTimeout(() => {
      scipNavigationTimerRef.current = null;
      window.location.assign(SITE_CONFIG.SCIP_PORTAL_URL);
    }, SCIP_NAVIGATION_DELAY_MS);
  }, [isNavigatingToSCIP]);

  const handleSCIPDialogOpenChange = useCallback(
    (open: boolean) => {
      if (!open && isNavigatingToSCIP) return;
      setActiveModal(open ? 'scip' : null);
    },
    [isNavigatingToSCIP],
  );

  const handleFooterLink = useCallback((id: (typeof footerLinks)[number]['id']) => {
    if (id === 'about') {
      setActiveModal('about');
    } else if (id === 'privacy') {
      setActiveModal('privacy');
    }
  }, []);

  const renderFeatureCard = useCallback((feature: (typeof landingFeatures)[number]) => {
    const commonProps = {
      title: feature.title,
      description: feature.description,
      icon: feature.icon,
    };

    // Link cards
    if (feature.kind === 'link' && feature.to) {
      const isExternalLink = /^https?:\/\//.test(feature.to);

      if (isExternalLink) {
        return (
          <a
            key={feature.id}
            href={feature.to}
            target="_blank"
            rel="noreferrer noopener"
            className="lpt-minimal-card"
            title={feature.linkTitle ?? feature.description}
            aria-label={`${feature.title} – ${feature.description}`}
            itemType={feature.itemType}
            itemID={feature.itemID}
          >
            <FeatureCard variant="minimal" {...commonProps} />
          </a>
        );
      }

      return (
        <Link
          key={feature.id}
          to={feature.to}
          className="lpt-minimal-card"
          title={feature.description}
          aria-label={`${feature.title} – ${feature.description}`}
        >
          <FeatureCard variant="minimal" {...commonProps} />
        </Link>
      );
    }

    // Action cards (SCIP)
    if (feature.kind === 'action') {
      return (
        <button
          key={feature.id}
          type="button"
          onClick={() => setActiveModal('scip')}
          className="lpt-minimal-card"
          title={feature.description}
          aria-label={`${feature.title} – ${feature.description}`}
        >
          <FeatureCard variant="minimal" {...commonProps} />
        </button>
      );
    }

    // Disabled cards
    if (feature.kind === 'disabled') {
      const disabledMessage =
        feature.disabledTooltip ??
        `${feature.title} is currently unavailable. We're working to restore access soon.`;

      return (
        <div
          key={feature.id}
          className={cn('lpt-minimal-card', 'lpt-minimal-card-disabled')}
          aria-disabled="true"
          title={disabledMessage}
          aria-label={`${feature.title} – ${feature.description}. ${disabledMessage}`}
          data-disabled-tooltip={disabledMessage}
        >
          <FeatureCard
            variant="minimal"
            {...commonProps}
            badge={feature.badge}
            disabled
            disabledLabel={feature.badge}
          />
        </div>
      );
    }

    // Default cards
    return (
      <div key={feature.id} className="lpt-minimal-card">
        <FeatureCard variant="minimal" {...commonProps} />
      </div>
    );
  }, []);

  return (
    <div className="lpt-minimal-root">
      <div className="lpt-minimal-bg" aria-hidden="true" />

      <div className="lpt-minimal-language">
        <LocaleToggle />
      </div>

      <button
        onClick={toggleTheme}
        className="lpt-minimal-theme"
        aria-label={theme === 'light' ? copy.theme.switchToDark : copy.theme.switchToLight}
      >
        {theme === 'light' ? (
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M20 14.12A7.78 7.78 0 019.88 4a7.78 7.78 0 002.9 15.1 7.78 7.78 0 007.22-5z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
            <path
              d="M12 2v2m0 16v2M2 12h2m16 0h2m-3-7l-1.5 1.5M4.93 4.93l1.5 1.5m11.14 11.14l1.5 1.5M4.93 19.07l1.5-1.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        )}
      </button>

      <div className="lpt-minimal-content">
        <div className="lpt-minimal-hero">
          <div className="lpt-minimal-logo">
            <LogoImage size="xl" />
          </div>

          <h1 className="lpt-minimal-title">{copy.heading}</h1>
          <p className="lpt-minimal-subtitle">{copy.subtitle}</p>

          <div className="lpt-minimal-cards">{landingFeatures.map(renderFeatureCard)}</div>
        </div>
      </div>

      <footer className="lpt-minimal-footer" role="contentinfo">
        <div className="lpt-minimal-footer-links">
          {footerLinks.map((link) =>
            link.id === 'contact' ? (
              <a
                key={link.id}
                href={`mailto:${SITE_CONFIG.CONTACT_EMAIL}?subject=${encodeURIComponent(copy.footer.contactSubject)}`}
                className="lpt-minimal-footer-link"
              >
                <link.icon className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{copy.footer[link.id]}</span>
              </a>
            ) : (
              <button
                key={link.id}
                type="button"
                onClick={() => handleFooterLink(link.id)}
                className="lpt-minimal-footer-link"
              >
                <link.icon className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{copy.footer[link.id]}</span>
              </button>
            ),
          )}
        </div>

        <div className="lpt-minimal-footer-meta">
          <p>
            {formatFooterCopy(copy.footer.copyright, {
              year: String(SITE_CONFIG.COPYRIGHT_YEAR),
            })}
          </p>
          <p style={{ marginTop: '0.25rem' }}>
            {formatFooterCopy(copy.footer.lastUpdated, {
              date: formatLastUpdatedDate(locale),
            })}
          </p>
        </div>
      </footer>

      {/* Privacy Modal */}
      <Dialog open={activeModal === 'privacy'} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent closeLabel={copy.privacy.close} className="max-w-[32rem] max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{copy.privacy.title}</DialogTitle>
            <DialogDescription>{copy.privacy.description}</DialogDescription>
          </DialogHeader>
          <ScrollableModal
            showScrollIndicator={privacyScrollIndicator}
            onScroll={(e) => handleScrollCheck(e, setPrivacyScrollIndicator)}
            contentClassName="space-y-4 sm:space-y-6"
          >
            <h3 className="text-base sm:text-lg font-semibold">
              {copy.privacy.generalNoticeTitle}
            </h3>
            <p className="text-sm sm:text-base text-[var(--text)] leading-relaxed">
              {copy.privacy.generalNotice}
            </p>
            <h3 className="text-base sm:text-lg font-semibold mt-4 sm:mt-6">
              {copy.privacy.informationTitle}
            </h3>
            <p className="text-sm sm:text-base text-[var(--text)] leading-relaxed">
              {copy.privacy.information}
            </p>
            <ul className="list-disc pl-5 space-y-2 text-sm sm:text-base text-[var(--text)] opacity-80">
              {copy.privacy.informationBullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
            <h3 className="text-base sm:text-lg font-semibold mt-4 sm:mt-6">
              {copy.privacy.externalLinksTitle}
            </h3>
            <p className="text-sm sm:text-base text-[var(--text)] leading-relaxed">
              {copy.privacy.externalLinks}
            </p>
            <div className="pt-2">
              <button onClick={closeModal} className={CLOSE_BUTTON_CLASS}>
                {copy.privacy.close}
              </button>
            </div>
          </ScrollableModal>
        </DialogContent>
      </Dialog>

      {/* About Modal */}
      <Dialog open={activeModal === 'about'} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent closeLabel={copy.about.close} className="max-w-lg max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{copy.about.title}</DialogTitle>
            <DialogDescription>{copy.about.description}</DialogDescription>
          </DialogHeader>
          <ScrollableModal
            showScrollIndicator={aboutScrollIndicator}
            onScroll={(e) => handleScrollCheck(e, setAboutScrollIndicator)}
          >
            <h3 className="text-base sm:text-lg font-semibold mb-2 text-[var(--primary)]">
              {copy.about.hubTitle}
            </h3>
            <p className="mb-3 sm:mb-4 text-sm sm:text-base">{copy.about.introduction}</p>
            <h3 className="text-base sm:text-lg font-semibold mb-2">
              {copy.about.keyFeaturesTitle}
            </h3>
            <ul className="list-disc list-inside mb-3 sm:mb-4 text-sm sm:text-base space-y-1">
              {copy.about.keyFeatures.map((feature) => (
                <li key={feature.title}>
                  <strong className="text-[var(--primary)]">{feature.title}</strong> –{' '}
                  {feature.description}
                </li>
              ))}
            </ul>
            <h3 className="text-base sm:text-lg font-semibold mb-2">
              {copy.about.disclaimerTitle}
            </h3>
            <p className="mb-3 sm:mb-4 text-sm sm:text-base text-[var(--text-secondary)]">
              {copy.about.disclaimer}
            </p>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-4 pt-4 border-t border-[var(--border)]">
              {copy.about.maintainedBy}
            </p>
            <div className="pt-4">
              <button onClick={closeModal} className={CLOSE_BUTTON_CLASS}>
                {copy.about.close}
              </button>
            </div>
          </ScrollableModal>
        </DialogContent>
      </Dialog>

      {/* SCIP Confirmation Modal */}
      <Dialog open={activeModal === 'scip'} onOpenChange={handleSCIPDialogOpenChange}>
        <DialogContent
          closeLabel={copy.about.close}
          showClose={!isNavigatingToSCIP}
          className="w-[92vw] sm:max-w-lg md:max-w-xl lg:max-w-2xl break-words"
        >
          <DialogHeader>
            <DialogTitle>{copy.scipConfirmation.title}</DialogTitle>
            <DialogDescription className="sr-only">
              {copy.scipConfirmation.externalServiceNote}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm sm:text-base break-words">{copy.scipConfirmation.introduction}</p>
            <p className="text-sm sm:text-base text-[var(--text-secondary)] break-words">
              {copy.scipConfirmation.externalServiceNote}
            </p>
            <div className="mb-2 p-3 bg-[var(--background-secondary)] rounded-lg border border-[var(--border)] w-full">
              <p className="text-xs sm:text-sm text-[var(--text-secondary)] mb-3">
                {copy.scipConfirmation.copyPrompt}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-2 items-center">
                <div className="min-w-0 w-full p-2 bg-[var(--background)] rounded text-xs font-mono text-[var(--text-secondary)] overflow-hidden">
                  <div className="block truncate max-w-full">
                    {SITE_CONFIG.SCIP_PORTAL_URL.substring(0, 50)}...
                  </div>
                </div>
                <button
                  onClick={copySCIPLink}
                  disabled={isLinkCopied}
                  className={cn(
                    'min-h-11 px-3 py-2 text-xs sm:text-sm rounded-lg transition-all duration-300 flex items-center gap-2 whitespace-nowrap shrink-0 mt-2 sm:mt-0 justify-center',
                    isLinkCopied
                      ? 'bg-green-600/20 text-green-600 cursor-not-allowed'
                      : 'bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]',
                  )}
                >
                  {isLinkCopied ? copy.copyLinkStatus.copied : copy.copyLinkStatus.copy}
                </button>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={closeModal}
                disabled={isNavigatingToSCIP}
                className="min-h-11 px-4 py-2 text-sm sm:text-base text-[var(--text)] bg-[var(--background-secondary)] hover:bg-[var(--background)] rounded-lg transition-colors duration-300"
              >
                {copy.scipConfirmation.cancel}
              </button>
              <button
                type="button"
                onClick={confirmSCIPNavigation}
                disabled={isNavigatingToSCIP}
                className={cn(
                  'min-h-11 px-4 py-2 text-sm sm:text-base rounded-lg transition-colors duration-300',
                  isNavigatingToSCIP
                    ? 'bg-[var(--primary)]/60 text-white cursor-not-allowed'
                    : 'text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)]',
                )}
              >
                {isNavigatingToSCIP
                  ? copy.navigationStatus.opening
                  : copy.navigationStatus.continue}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default LandingPage;
