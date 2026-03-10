import React, { useCallback, useEffect, useState } from 'react';
import { ShoppingBag, Coins, Package, AlertCircle, CheckCircle, History } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import { formatNumber } from '../lib/utils';
import { checkAuthStatus } from '../lib/auth';
import { productAPI } from '../lib/api';
import { ProductCard } from '../components/store/ProductCard';
import { ExchangeModal } from '../components/store/ExchangeModal';
import { StoreFilters } from '../components/store/StoreFilters';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';

const normalizeStoreCategory = (item) => {
  if (!item) {
    return null;
  }
  if (typeof item === 'string') {
    const name = item.trim();
    if (!name) {
      return null;
    }
    const slug = name.trim();
    return {
      name,
      category: name,
      slug,
      product_count: 0,
    };
  }
  const nameRaw = item.name ?? item.category ?? '';
  const name = typeof nameRaw === 'string' ? nameRaw.trim() : String(nameRaw || '').trim();
  const slugRaw = item.slug ?? item.category_slug ?? item.category ?? name;
  const slugBase = typeof slugRaw === 'string' ? slugRaw.trim() : String(slugRaw || '').trim();
  const slugValue = (slugBase || name || '').toString().trim();
  const slug = slugValue ? slugValue.toLowerCase() : slugValue;
  const productCount = item.product_count ?? item.count ?? item.total ?? 0;
  return {
    ...item,
    name: name || slugValue,
    category: item.category ?? name ?? slugValue,
    slug: slug || slugValue,
    product_count: productCount,
  };
};

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';

export default function StorePage() {
  const { t } = useTranslation();
  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exchangeLoading, setExchangeLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // 筛选和分页状态
  const [filters, setFilters] = useState({
    search: '',
    category: '',
    min_points: '',
    max_points: '',
    sort: 'created_at',
    page: 1,
    limit: 12,
    tags: []
  });
  const [pagination, setPagination] = useState({
    page: 1,
    pages: 1,
    total: 0
  });

  // 兑换模态框状态
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showExchangeModal, setShowExchangeModal] = useState(false);

  // 获取用户信息
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const authStatus = await checkAuthStatus();
        if (authStatus.isAuthenticated) {
          setUser(authStatus.user);
        }
      } catch (error) {
        console.error('Failed to fetch user:', error);
      }
    };
    fetchUser();
  }, []);

  // 获取商品列表
  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const query = {};
      Object.entries(filters).forEach(([key, value]) => {
        if (key === 'tags') {
          if (Array.isArray(value) && value.length) {
            query.tags = value.map((tag) => tag.slug || tag).join(',');
          }
          return;
        }
        if (value !== '' && value !== null && value !== undefined) {
          query[key] = value;
        }
      });

      const res = await productAPI.getProducts(query);
      const payload = res.data?.data ?? res.data;
      const items = Array.isArray(payload) ? payload : (payload?.products ?? []);
      const paginationData = (Array.isArray(payload) ? null : payload?.pagination) || {};
      const pageInfo = {
        page: paginationData.page ?? paginationData.current_page ?? query.page ?? filters.page ?? 1,
        pages: paginationData.pages ?? paginationData.total_pages ?? 1,
        total: paginationData.total ?? paginationData.total_items ?? items.length,
      };

      if (res.data?.success !== false) {
        setProducts(items);
        setPagination({
          page: pageInfo.page ?? 1,
          pages: pageInfo.pages ?? 1,
          total: pageInfo.total ?? items.length,
        });
      } else {
        setProducts([]);
        setPagination({ page: 1, pages: 1, total: 0 });
        setError(t('store.errors.loadFailed'));
      }
    } catch (error) {
      console.error('Failed to fetch products:', error);
      setError(t('store.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [filters, t]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await productAPI.getCategories();
      const payload = res.data?.data;
      const source = Array.isArray(payload?.categories)
        ? payload.categories
        : Array.isArray(payload)
          ? payload
          : res.data?.categories || [];
      const normalized = Array.isArray(source)
        ? source.map((item) => normalizeStoreCategory(item)).filter(Boolean)
        : [];
      setCategories(normalized);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // 获取分类列表
  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleExchange = (product) => {
    if (!user) {
      setError(t('store.errors.loginRequired'));
      return;
    }
    setSelectedProduct(product);
    setShowExchangeModal(true);
  };

  const handleConfirmExchange = async (exchangeData) => {
    try {
      setExchangeLoading(true);
      setError(null);

      const res = await productAPI.exchangeProduct(exchangeData);
      const { success, data, points_used, remaining_points } = res.data || {};
      if (success) {
        const used = points_used ?? data?.points_used ?? 0;
        const remaining = remaining_points ?? data?.remaining_points;
        setSuccess(t('store.exchange.success', {
          product: selectedProduct.name,
          points: used
        }));
        setUser(prev => ({
          ...prev,
          points: typeof remaining === 'number' ? remaining : prev.points
        }));
        fetchProducts();
        setShowExchangeModal(false);
        setSelectedProduct(null);
      } else {
        setError(t('store.errors.exchangeFailed'));
      }
    } catch (error) {
      console.error('Exchange failed:', error);
      setError(t('store.errors.exchangeFailed'));
    } finally {
      setExchangeLoading(false);
    }
  };

  const handlePageChange = (page) => {
    setFilters(prev => ({ ...prev, page }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardHeader className="text-center">
            <ShoppingBag className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <CardTitle>{t('store.loginRequired.title')}</CardTitle>
            <CardDescription>{t('store.loginRequired.description')}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => window.location.href = '/auth/login'}>
              {t('auth.signIn')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* 页面标题和用户积分 */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {t('store.title')}
              </h1>
              <p className="text-gray-600">{t('store.subtitle')}</p>
            </div>
            <div className="mt-4 md:mt-0">
              <Card className="bg-gradient-to-r from-green-500 to-blue-500 text-white">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <Coins className="h-8 w-8" />
                    <div>
                      <p className="text-sm opacity-90">{t('store.yourPoints')}</p>
                      <p className="text-2xl font-bold">
                        {formatNumber(user.points)} {t('common.points')}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* 错误和成功提示 */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setError(null)}
              className="ml-auto"
            >
              ×
            </Button>
          </Alert>
        )}

        {success && (
          <Alert variant="default" className="mb-6 border-green-200 bg-green-50 text-green-800">
            <CheckCircle className="h-4 w-4" />
            <span>{success}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSuccess(null)}
              className="ml-auto"
            >
              ×
            </Button>
          </Alert>
        )}

        {/* 筛选器 */}
        <StoreFilters
          filters={filters}
          onFiltersChange={setFilters}
          categories={categories}
          isLoading={loading}
        />

        {/* 商品列表 */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="animate-pulse">
                <div className="bg-white rounded-lg shadow-sm border p-4">
                  <div className="h-48 bg-gray-200 rounded-lg mb-4"></div>
                  <div className="h-4 bg-gray-200 rounded mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3 mb-4"></div>
                  <div className="h-10 bg-gray-200 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <CardTitle className="text-xl text-gray-600 mb-2">
                {t('store.noProducts.title')}
              </CardTitle>
              <CardDescription>
                {t('store.noProducts.description')}
              </CardDescription>
              {(filters.search || filters.category || filters.min_points || filters.max_points) && (
                <Button
                  variant="outline"
                  onClick={() => setFilters({
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
                  {t('store.filters.clear')}
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            {/* 商品网格 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  userPoints={user.points}
                  onExchange={handleExchange}
                />
              ))}
            </div>

            {/* 分页 */}
            {pagination.pages > 1 && (
              <div className="flex justify-center items-center space-x-2">
                <Button
                  variant="outline"
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                >
                  {t('common.previous')}
                </Button>
                
                <div className="flex space-x-1">
                  {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                    let page;
                    if (pagination.pages <= 5) {
                      page = i + 1;
                    } else if (pagination.page <= 3) {
                      page = i + 1;
                    } else if (pagination.page >= pagination.pages - 2) {
                      page = pagination.pages - 4 + i;
                    } else {
                      page = pagination.page - 2 + i;
                    }
                    
                    return (
                      <Button
                        key={page}
                        variant={pagination.page === page ? "default" : "outline"}
                        onClick={() => handlePageChange(page)}
                        className="w-10"
                      >
                        {page}
                      </Button>
                    );
                  })}
                </div>

                <Button
                  variant="outline"
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.pages}
                >
                  {t('common.next')}
                </Button>
              </div>
            )}
          </>
        )}

        {/* 快速操作 */}
        <div className="mt-8 text-center">
          <Button
            variant="outline"
            onClick={() => window.location.href = '/activities'}
            className="mr-4"
          >
            <History className="h-4 w-4 mr-2" />
            {t('store.viewExchangeHistory')}
          </Button>
          <Button
            onClick={() => window.location.href = '/calculate'}
            className="bg-green-600 hover:bg-green-700"
          >
            <Coins className="h-4 w-4 mr-2" />
            {t('store.earnMorePoints')}
          </Button>
        </div>
      </div>

      {/* 兑换模态框 */}
      <ExchangeModal
        product={selectedProduct}
        userPoints={user?.points || 0}
        userEmail={user?.email || ''}
        isOpen={showExchangeModal}
        onClose={() => {
          setShowExchangeModal(false);
          setSelectedProduct(null);
        }}
        onConfirm={handleConfirmExchange}
        isLoading={exchangeLoading}
      />
    </div>
  );
}
