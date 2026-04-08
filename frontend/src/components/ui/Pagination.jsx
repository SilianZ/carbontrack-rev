import React from 'react';
import { useTranslation } from '../../hooks/useTranslation';

export function Pagination({ 
  currentPage, 
  totalPages, 
  onPageChange, 
  itemsPerPage, 
  totalItems,
  className = '' 
}) {
  const { t } = useTranslation(['common', 'pagination']);

  // 兜底处理，避免 undefined 导致 NaN 或键名显示问题
  const safeCurrent = Number.isFinite(currentPage) ? currentPage : 1;
  const safeTotalPages = Number.isFinite(totalPages) ? totalPages : 1;
  const safePerPage = Number.isFinite(itemsPerPage) ? itemsPerPage : 10;
  const safeTotalItems = Number.isFinite(totalItems) ? totalItems : 0;

  if (safeTotalPages <= 1) return null;

  const getVisiblePages = () => {
    const delta = 2;
    const range = [];
    const rangeWithDots = [];

    for (let i = Math.max(2, safeCurrent - delta); 
         i <= Math.min(safeTotalPages - 1, safeCurrent + delta); 
         i++) {
      range.push(i);
    }

    if (safeCurrent - delta > 2) {
      rangeWithDots.push(1, '...');
    } else {
      rangeWithDots.push(1);
    }

    rangeWithDots.push(...range);

    if (safeCurrent + delta < safeTotalPages - 1) {
      rangeWithDots.push('...', safeTotalPages);
    } else {
      rangeWithDots.push(safeTotalPages);
    }

    return rangeWithDots;
  };

  const visiblePages = getVisiblePages();

  return (
    <div className={`flex flex-col sm:flex-row items-center justify-between gap-4 ${className}`}>
      <div className="text-sm text-muted-foreground">
        {t('pagination.showing', {
          start: (safeCurrent - 1) * safePerPage + 1,
          end: Math.min(safeCurrent * safePerPage, safeTotalItems),
          total: safeTotalItems
        })}
      </div>

      <nav aria-label="Pagination">
        <ul className="inline-flex items-center gap-1">
          <li>
            <button
              onClick={() => safeCurrent > 1 && onPageChange(safeCurrent - 1)}
              className={`rounded-md border border-border px-3 py-2 text-sm text-foreground ${safeCurrent <= 1 ? 'cursor-not-allowed opacity-50' : 'hover:bg-muted/60'}`}
              disabled={safeCurrent <= 1}
            >
              {t('common.previous')}
            </button>
          </li>

          {visiblePages.map((page, index) => (
            <li key={index}>
              {page === '...' ? (
                <span className="px-3 py-2 text-sm text-muted-foreground">…</span>
              ) : (
                <button
                  onClick={() => onPageChange(page)}
                  className={`rounded-md border px-3 py-2 text-sm ${page === safeCurrent ? 'border-border bg-muted text-foreground' : 'border-border text-foreground hover:bg-muted/60'}`}
                >
                  {page}
                </button>
              )}
            </li>
          ))}

          <li>
            <button
              onClick={() => safeCurrent < safeTotalPages && onPageChange(safeCurrent + 1)}
              className={`rounded-md border border-border px-3 py-2 text-sm text-foreground ${safeCurrent >= safeTotalPages ? 'cursor-not-allowed opacity-50' : 'hover:bg-muted/60'}`}
              disabled={safeCurrent >= safeTotalPages}
            >
              {t('common.next')}
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}
