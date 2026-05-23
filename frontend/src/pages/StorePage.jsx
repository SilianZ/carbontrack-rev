import Silian_React, { useCallback as Silian_useCallback, useEffect as Silian_useEffect, useState as Silian_useState } from 'react';
import { ShoppingBag as Silian_ShoppingBag, Coins as Silian_Coins, Package as Silian_Package, AlertCircle as Silian_AlertCircle, CheckCircle as Silian_CheckCircle, History as Silian_History } from 'lucide-react';
import { useTranslation as Silian_useTranslation } from '../hooks/useTranslation';
import { formatNumber as Silian_formatNumber } from '../lib/utils';
import { checkAuthStatus as Silian_checkAuthStatus } from '../lib/auth';
import { productAPI as Silian_productAPI } from '../lib/api';
import { ProductCard as Silian_ProductCard } from '../components/store/ProductCard';
import { ExchangeModal as Silian_ExchangeModal } from '../components/store/ExchangeModal';
import { StoreFilters as Silian_StoreFilters } from '../components/store/StoreFilters';
import { Button as Silian_Button } from '../components/ui/Button';
import { Alert as Silian_Alert } from '../components/ui/Alert';

const Silian_normalizeStoreCategory = (Silian_item) => {
  if (!Silian_item) {
    return null;
  }
  if (typeof Silian_item === 'string') {
    const Silian_name = Silian_item.trim();
    if (!Silian_name) {
      return null;
    }
    const Silian_slug = Silian_name.trim();
    return {
      name: Silian_name,
      category: Silian_name,
      slug: Silian_slug,
      product_count: 0,
    };
  }
  const Silian_nameRaw = Silian_item.name ?? Silian_item.category ?? '';
  const Silian_name = typeof Silian_nameRaw === 'string' ? Silian_nameRaw.trim() : String(Silian_nameRaw || '').trim();
  const Silian_slugRaw = Silian_item.slug ?? Silian_item.category_slug ?? Silian_item.category ?? Silian_name;
  const Silian_slugBase = typeof Silian_slugRaw === 'string' ? Silian_slugRaw.trim() : String(Silian_slugRaw || '').trim();
  const Silian_slugValue = (Silian_slugBase || Silian_name || '').toString().trim();
  const Silian_slug = Silian_slugValue ? Silian_slugValue.toLowerCase() : Silian_slugValue;
  const Silian_productCount = Silian_item.product_count ?? Silian_item.count ?? Silian_item.total ?? 0;
  return {
    ...Silian_item,
    name: Silian_name || Silian_slugValue,
    category: Silian_item.category ?? Silian_name ?? Silian_slugValue,
    slug: Silian_slug || Silian_slugValue,
    product_count: Silian_productCount,
  };
};

import { Card as Silian_Card, CardContent as Silian_CardContent, CardDescription as Silian_CardDescription, CardHeader as Silian_CardHeader, CardTitle as Silian_CardTitle } from '../components/ui/Card';

export default function StorePage() {
  const { t: Silian_t } = Silian_useTranslation(['auth', 'common', 'errors', 'pagination', 'products', 'store', 'success']);
  const [Silian_user, Silian_setUser] = Silian_useState(null);
  const [Silian_products, Silian_setProducts] = Silian_useState([]);
  const [Silian_categories, Silian_setCategories] = Silian_useState([]);
  const [Silian_loading, Silian_setLoading] = Silian_useState(true);
  const [Silian_exchangeLoading, Silian_setExchangeLoading] = Silian_useState(false);
  const [Silian_error, Silian_setError] = Silian_useState(null);
  const [Silian_success, Silian_setSuccess] = Silian_useState(null);

  // 筛选和分页状态
  const [Silian_filters, Silian_setFilters] = Silian_useState({
    search: '',
    category: '',
    min_points: '',
    max_points: '',
    sort: 'created_at',
    page: 1,
    limit: 12,
    tags: []
  });
  const [Silian_pagination, Silian_setPagination] = Silian_useState({
    page: 1,
    pages: 1,
    total: 0
  });

  // 兑换模态框状态
  const [Silian_selectedProduct, Silian_setSelectedProduct] = Silian_useState(null);
  const [Silian_showExchangeModal, Silian_setShowExchangeModal] = Silian_useState(false);

  // 获取用户信息
  Silian_useEffect(() => {
    const Silian_fetchUser = async () => {
      try {
        const Silian_authStatus = await Silian_checkAuthStatus();
        if (Silian_authStatus.isAuthenticated) {
          Silian_setUser(Silian_authStatus.user);
        }
      } catch (Silian_error) {
        console.error('Failed to fetch user:', Silian_error);
      }
    };
    Silian_fetchUser();
  }, []);

  // 获取商品列表
  const Silian_fetchProducts = Silian_useCallback(async () => {
    try {
      Silian_setLoading(true);
      Silian_setError(null);

      const Silian_query = {};
      Object.entries(Silian_filters).forEach(([Silian_key, Silian_value]) => {
        if (Silian_key === 'tags') {
          if (Array.isArray(Silian_value) && Silian_value.length) {
            Silian_query.tags = Silian_value.map((Silian_tag) => Silian_tag.slug || Silian_tag).join(',');
          }
          return;
        }
        if (Silian_value !== '' && Silian_value !== null && Silian_value !== undefined) {
          Silian_query[Silian_key] = Silian_value;
        }
      });

      const Silian_res = await Silian_productAPI.getProducts(Silian_query);
      const Silian_payload = Silian_res.data?.data ?? Silian_res.data;
      const Silian_items = Array.isArray(Silian_payload) ? Silian_payload : (Silian_payload?.products ?? []);
      const Silian_paginationData = (Array.isArray(Silian_payload) ? null : Silian_payload?.pagination) || {};
      const Silian_pageInfo = {
        page: Silian_paginationData.page ?? Silian_paginationData.current_page ?? Silian_query.page ?? Silian_filters.page ?? 1,
        pages: Silian_paginationData.pages ?? Silian_paginationData.total_pages ?? 1,
        total: Silian_paginationData.total ?? Silian_paginationData.total_items ?? Silian_items.length,
      };

      if (Silian_res.data?.success !== false) {
        Silian_setProducts(Silian_items);
        Silian_setPagination({
          page: Silian_pageInfo.page ?? 1,
          pages: Silian_pageInfo.pages ?? 1,
          total: Silian_pageInfo.total ?? Silian_items.length,
        });
      } else {
        Silian_setProducts([]);
        Silian_setPagination({ page: 1, pages: 1, total: 0 });
        Silian_setError(Silian_t('store.errors.loadFailed'));
      }
    } catch (Silian_error) {
      console.error('Failed to fetch products:', Silian_error);
      Silian_setError(Silian_t('store.errors.loadFailed'));
    } finally {
      Silian_setLoading(false);
    }
  }, [Silian_filters, Silian_t]);

  const Silian_fetchCategories = Silian_useCallback(async () => {
    try {
      const Silian_res = await Silian_productAPI.getCategories();
      const Silian_payload = Silian_res.data?.data;
      const Silian_source = Array.isArray(Silian_payload?.categories)
        ? Silian_payload.categories
        : Array.isArray(Silian_payload)
          ? Silian_payload
          : Silian_res.data?.categories || [];
      const Silian_normalized = Array.isArray(Silian_source)
        ? Silian_source.map((Silian_item) => Silian_normalizeStoreCategory(Silian_item)).filter(Boolean)
        : [];
      Silian_setCategories(Silian_normalized);
    } catch (Silian_error) {
      console.error('Failed to fetch categories:', Silian_error);
    }
  }, []);

  Silian_useEffect(() => {
    Silian_fetchProducts();
  }, [Silian_fetchProducts]);

  // 获取分类列表
  Silian_useEffect(() => {
    Silian_fetchCategories();
  }, [Silian_fetchCategories]);

  const Silian_handleExchange = (Silian_product) => {
    if (!Silian_user) {
      Silian_setError(Silian_t('store.errors.loginRequired'));
      return;
    }
    Silian_setSelectedProduct(Silian_product);
    Silian_setShowExchangeModal(true);
  };

  const Silian_handleConfirmExchange = async (Silian_exchangeData) => {
    try {
      Silian_setExchangeLoading(true);
      Silian_setError(null);

      const Silian_res = await Silian_productAPI.exchangeProduct(Silian_exchangeData);
      const { success: Silian_success, data: Silian_data, points_used: Silian_points_used, remaining_points: Silian_remaining_points } = Silian_res.data || {};
      if (Silian_success) {
        const Silian_used = Silian_points_used ?? Silian_data?.points_used ?? 0;
        const Silian_remaining = Silian_remaining_points ?? Silian_data?.remaining_points;
        Silian_setSuccess(Silian_t('store.exchange.success', {
          product: Silian_selectedProduct.name,
          points: Silian_used
        }));
        Silian_setUser(Silian_prev => ({
          ...Silian_prev,
          points: typeof Silian_remaining === 'number' ? Silian_remaining : Silian_prev.points
        }));
        Silian_fetchProducts();
        Silian_setShowExchangeModal(false);
        Silian_setSelectedProduct(null);
      } else {
        Silian_setError(Silian_t('store.errors.exchangeFailed'));
      }
    } catch (Silian_error) {
      console.error('Exchange failed:', Silian_error);
      Silian_setError(Silian_t('store.errors.exchangeFailed'));
    } finally {
      Silian_setExchangeLoading(false);
    }
  };

  const Silian_handlePageChange = (Silian_page) => {
    Silian_setFilters(Silian_prev => ({ ...Silian_prev, page: Silian_page }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!Silian_user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Silian_Card className="max-w-md w-full mx-4">
          <Silian_CardHeader className="text-center">
            <Silian_ShoppingBag className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <Silian_CardTitle>{Silian_t('store.loginRequired.title')}</Silian_CardTitle>
            <Silian_CardDescription>{Silian_t('store.loginRequired.description')}</Silian_CardDescription>
          </Silian_CardHeader>
          <Silian_CardContent className="text-center">
            <Silian_Button onClick={() => window.location.href = '/auth/login'}>
              {Silian_t('auth.signIn')}
            </Silian_Button>
          </Silian_CardContent>
        </Silian_Card>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-hidden">
      {/* Ambient Glow */}
      <div className="absolute top-0 right-0 -z-10 h-[600px] w-[600px] blur-[120px] bg-gradient-to-bl from-blue-50/50 via-purple-50/30 to-transparent opacity-50 dark:from-blue-900/20 dark:via-purple-900/10 dark:opacity-30 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 py-8 relative">
        {/* 页面标题和用户积分 */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="mb-2 text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-gray-900 to-gray-600 dark:from-white dark:to-white/60">
                {Silian_t('store.title')}
              </h1>
              <p className="text-muted-foreground">{Silian_t('store.subtitle')}</p>
            </div>
            <div className="mt-4 md:mt-0">
              <Silian_Card className="bg-gradient-to-r from-green-500 to-blue-500 text-white">
                <Silian_CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <Silian_Coins className="h-8 w-8" />
                    <div>
                      <p className="text-sm opacity-90">{Silian_t('store.yourPoints')}</p>
                      <p className="text-2xl font-bold">
                        {Silian_formatNumber(Silian_user.points)} {Silian_t('common.points')}
                      </p>
                    </div>
                  </div>
                </Silian_CardContent>
              </Silian_Card>
            </div>
          </div>
        </div>

        {/* 错误和成功提示 */}
        {Silian_error && (
          <Silian_Alert variant="destructive" className="mb-6">
            <Silian_AlertCircle className="h-4 w-4" />
            <span>{Silian_error}</span>
            <Silian_Button
              variant="ghost"
              size="sm"
              onClick={() => Silian_setError(null)}
              className="ml-auto"
            >
              ×
            </Silian_Button>
          </Silian_Alert>
        )}

        {Silian_success && (
          <Silian_Alert variant="default" className="mb-6 border-green-500/20 bg-green-500/10 text-green-500">
            <Silian_CheckCircle className="h-4 w-4" />
            <span>{Silian_success}</span>
            <Silian_Button
              variant="ghost"
              size="sm"
              onClick={() => Silian_setSuccess(null)}
              className="ml-auto"
            >
              ×
            </Silian_Button>
          </Silian_Alert>
        )}

        {/* 筛选器 */}
        <Silian_StoreFilters
          filters={Silian_filters}
          onFiltersChange={Silian_setFilters}
          categories={Silian_categories}
          isLoading={Silian_loading}
        />

        {/* 商品列表 */}
        {Silian_loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((Silian__, Silian_index) => (
              <div key={Silian_index} className="animate-pulse">
                <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
                  <div className="mb-4 h-48 rounded-lg bg-muted"></div>
                  <div className="mb-2 h-4 rounded bg-muted"></div>
                  <div className="mb-4 h-4 w-2/3 rounded bg-muted"></div>
                  <div className="h-10 rounded bg-muted"></div>
                </div>
              </div>
            ))}
          </div>
        ) : Silian_products.length === 0 ? (
          <Silian_Card className="text-center py-12">
            <Silian_CardContent>
              <Silian_Package className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
              <Silian_CardTitle className="mb-2 text-xl text-foreground">
                {Silian_t('store.noProducts.title')}
              </Silian_CardTitle>
              <Silian_CardDescription>
                {Silian_t('store.noProducts.description')}
              </Silian_CardDescription>
              {(Silian_filters.search || Silian_filters.category || Silian_filters.min_points || Silian_filters.max_points) && (
                <Silian_Button
                  variant="outline"
                  onClick={() => Silian_setFilters({
                    search: '',
                    category: '',
                    min_points: '',
                    max_points: '',
                    sort: 'created_at',
                    page: 1,
                    limit: 12,
                    tags: []
                  })}
                  className="mt-4"
                >
                  {Silian_t('store.filters.clear')}
                </Silian_Button>
              )}
            </Silian_CardContent>
          </Silian_Card>
        ) : (
          <>
            {/* 商品网格 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
              {Silian_products.map((Silian_product) => (
                <Silian_ProductCard
                  key={Silian_product.id}
                  product={Silian_product}
                  userPoints={Silian_user.points}
                  onExchange={Silian_handleExchange}
                />
              ))}
            </div>

            {/* 分页 */}
            {Silian_pagination.pages > 1 && (
              <div className="flex justify-center items-center space-x-2">
                <Silian_Button
                  variant="outline"
                  onClick={() => Silian_handlePageChange(Silian_pagination.page - 1)}
                  disabled={Silian_pagination.page <= 1}
                >
                  {Silian_t('common.previous')}
                </Silian_Button>

                <div className="flex space-x-1">
                  {Array.from({ length: Math.min(5, Silian_pagination.pages) }, (Silian__, Silian_i) => {
                    let Silian_page;
                    if (Silian_pagination.pages <= 5) {
                      Silian_page = Silian_i + 1;
                    } else if (Silian_pagination.page <= 3) {
                      Silian_page = Silian_i + 1;
                    } else if (Silian_pagination.page >= Silian_pagination.pages - 2) {
                      Silian_page = Silian_pagination.pages - 4 + Silian_i;
                    } else {
                      Silian_page = Silian_pagination.page - 2 + Silian_i;
                    }

                    return (
                      <Silian_Button
                        key={Silian_page}
                        variant={Silian_pagination.page === Silian_page ? "default" : "outline"}
                        onClick={() => Silian_handlePageChange(Silian_page)}
                        className="w-10"
                      >
                        {Silian_page}
                      </Silian_Button>
                    );
                  })}
                </div>

                <Silian_Button
                  variant="outline"
                  onClick={() => Silian_handlePageChange(Silian_pagination.page + 1)}
                  disabled={Silian_pagination.page >= Silian_pagination.pages}
                >
                  {Silian_t('common.next')}
                </Silian_Button>
              </div>
            )}
          </>
        )}

        {/* 快速操作 */}
        <div className="mt-8 text-center">
          <Silian_Button
            variant="outline"
            onClick={() => window.location.href = '/store/exchanges'}
            className="mr-4"
          >
            <Silian_History className="h-4 w-4 mr-2" />
            {Silian_t('store.viewExchangeHistory')}
          </Silian_Button>
          <Silian_Button
            onClick={() => window.location.href = '/calculate'}
            className="bg-green-600 hover:bg-green-700"
          >
            <Silian_Coins className="h-4 w-4 mr-2" />
            {Silian_t('store.earnMorePoints')}
          </Silian_Button>
        </div>
      </div>

      {/* 兑换模态框 */}
      <Silian_ExchangeModal
        product={Silian_selectedProduct}
        userPoints={Silian_user?.points || 0}
        userEmail={Silian_user?.email || ''}
        isOpen={Silian_showExchangeModal}
        onClose={() => {
          Silian_setShowExchangeModal(false);
          Silian_setSelectedProduct(null);
        }}
        onConfirm={Silian_handleConfirmExchange}
        isLoading={Silian_exchangeLoading}
      />
    </div>
  );
}
