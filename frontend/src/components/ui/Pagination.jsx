import Silian_React from 'react';
import { useTranslation as Silian_useTranslation } from '../../hooks/useTranslation';

export function Pagination({
  currentPage: Silian_currentPage,
  totalPages: Silian_totalPages,
  onPageChange: Silian_onPageChange,
  itemsPerPage: Silian_itemsPerPage,
  totalItems: Silian_totalItems,
  className: Silian_className = ''
}) {
  const { t: Silian_t } = Silian_useTranslation(['common', 'pagination']);

  // 兜底处理，避免 undefined 导致 NaN 或键名显示问题
  const Silian_safeCurrent = Number.isFinite(Silian_currentPage) ? Silian_currentPage : 1;
  const Silian_safeTotalPages = Number.isFinite(Silian_totalPages) ? Silian_totalPages : 1;
  const Silian_safePerPage = Number.isFinite(Silian_itemsPerPage) ? Silian_itemsPerPage : 10;
  const Silian_safeTotalItems = Number.isFinite(Silian_totalItems) ? Silian_totalItems : 0;

  if (Silian_safeTotalPages <= 1) return null;

  const Silian_getVisiblePages = () => {
    const Silian_delta = 2;
    const Silian_range = [];
    const Silian_rangeWithDots = [];

    for (let Silian_i = Math.max(2, Silian_safeCurrent - Silian_delta);
         Silian_i <= Math.min(Silian_safeTotalPages - 1, Silian_safeCurrent + Silian_delta);
         Silian_i++) {
      Silian_range.push(Silian_i);
    }

    if (Silian_safeCurrent - Silian_delta > 2) {
      Silian_rangeWithDots.push(1, '...');
    } else {
      Silian_rangeWithDots.push(1);
    }

    Silian_rangeWithDots.push(...Silian_range);

    if (Silian_safeCurrent + Silian_delta < Silian_safeTotalPages - 1) {
      Silian_rangeWithDots.push('...', Silian_safeTotalPages);
    } else {
      Silian_rangeWithDots.push(Silian_safeTotalPages);
    }

    return Silian_rangeWithDots;
  };

  const Silian_visiblePages = Silian_getVisiblePages();

  return (
    <div className={`flex flex-col sm:flex-row items-center justify-between gap-4 ${Silian_className}`}>
      <div className="text-sm text-muted-foreground">
        {Silian_t('pagination.showing', {
          start: (Silian_safeCurrent - 1) * Silian_safePerPage + 1,
          end: Math.min(Silian_safeCurrent * Silian_safePerPage, Silian_safeTotalItems),
          total: Silian_safeTotalItems
        })}
      </div>

      <nav aria-label="Pagination">
        <ul className="inline-flex items-center gap-1">
          <li>
            <button
              onClick={() => Silian_safeCurrent > 1 && Silian_onPageChange(Silian_safeCurrent - 1)}
              className={`rounded-md border border-border px-3 py-2 text-sm text-foreground ${Silian_safeCurrent <= 1 ? 'cursor-not-allowed opacity-50' : 'hover:bg-muted/60'}`}
              disabled={Silian_safeCurrent <= 1}
            >
              {Silian_t('common.previous')}
            </button>
          </li>

          {Silian_visiblePages.map((Silian_page, Silian_index) => (
            <li key={Silian_index}>
              {Silian_page === '...' ? (
                <span className="px-3 py-2 text-sm text-muted-foreground">…</span>
              ) : (
                <button
                  onClick={() => Silian_onPageChange(Silian_page)}
                  className={`rounded-md border px-3 py-2 text-sm ${Silian_page === Silian_safeCurrent ? 'border-border bg-muted text-foreground' : 'border-border text-foreground hover:bg-muted/60'}`}
                >
                  {Silian_page}
                </button>
              )}
            </li>
          ))}

          <li>
            <button
              onClick={() => Silian_safeCurrent < Silian_safeTotalPages && Silian_onPageChange(Silian_safeCurrent + 1)}
              className={`rounded-md border border-border px-3 py-2 text-sm text-foreground ${Silian_safeCurrent >= Silian_safeTotalPages ? 'cursor-not-allowed opacity-50' : 'hover:bg-muted/60'}`}
              disabled={Silian_safeCurrent >= Silian_safeTotalPages}
            >
              {Silian_t('common.next')}
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}
