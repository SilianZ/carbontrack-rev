import Silian_React, { useCallback as Silian_useCallback, useEffect as Silian_useEffect, useMemo as Silian_useMemo, useRef as Silian_useRef, useState as Silian_useState } from 'react';
import { useMutation as Silian_useMutation, useQuery as Silian_useQuery, useQueryClient as Silian_useQueryClient } from 'react-query';
import { Loader2 as Silian_Loader2, Edit as Silian_Edit, Trash2 as Silian_Trash2, PlusCircle as Silian_PlusCircle, Search as Silian_Search, Image as Silian_ImageIcon, X as Silian_X } from 'lucide-react';
import { toast as Silian_toast } from 'react-hot-toast';

import { useTranslation as Silian_useTranslation } from '@/hooks/useTranslation';
import { adminAPI as Silian_adminAPI, productAPI as Silian_productAPI } from '@/lib/api';
import { formatNumber as Silian_formatNumber } from '@/lib/utils';
import { uploadViaPresign as Silian_uploadViaPresign } from '@/lib/r2Upload';
import { prefetchPresignedUrls as Silian_prefetchPresignedUrls, getPresignedReadUrl as Silian_getPresignedReadUrl } from '@/lib/fileAccess';

import Silian_R2Image from '@/components/common/R2Image';
import { Button as Silian_Button } from '@/components/ui/Button';
import { Input as Silian_Input } from '@/components/ui/Input';
import { Textarea as Silian_Textarea } from '@/components/ui/textarea';
import { Badge as Silian_Badge } from '@/components/ui/badge';
import { Alert as Silian_Alert, AlertDescription as Silian_AlertDescription, AlertTitle as Silian_AlertTitle } from '@/components/ui/Alert';
import {
  AlertDialog as Silian_AlertDialog,
  AlertDialogAction as Silian_AlertDialogAction,
  AlertDialogCancel as Silian_AlertDialogCancel,
  AlertDialogContent as Silian_AlertDialogContent,
  AlertDialogDescription as Silian_AlertDialogDescription,
  AlertDialogFooter as Silian_AlertDialogFooter,
  AlertDialogHeader as Silian_AlertDialogHeader,
  AlertDialogTitle as Silian_AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog as Silian_Dialog,
  DialogContent as Silian_DialogContent,
  DialogDescription as Silian_DialogDescription,
  DialogFooter as Silian_DialogFooter,
  DialogHeader as Silian_DialogHeader,
  DialogTitle as Silian_DialogTitle,
} from '@/components/ui/dialog';
import { Pagination as Silian_Pagination } from '@/components/ui/Pagination';

const Silian_DEFAULT_FORM = {
  name: '',
  description: '',
  category: null,
  points_required: 0,
  stock: -1,
  status: 'active',
  sort_order: 0,
  image_path: '',
  image_url: '',
  image_presigned_url: '',
  images: [],
  tags: [],
};

const Silian_STATUS_OPTIONS = [
  { value: 'active', labelKey: 'admin.products.statusActive' },
  { value: 'inactive', labelKey: 'admin.products.statusInactive' },
];

const Silian_PRODUCT_STATUS_BADGE_STYLES = {
  active: 'border border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300',
  inactive: 'border border-slate-200 bg-slate-100 text-slate-700 dark:border-border dark:bg-muted dark:text-muted-foreground',
  outOfStock: 'border border-red-200 bg-red-100 text-red-800 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-300',
};

const Silian_sanitizeNumber = (Silian_value, Silian_fallback = 0) => {
  if (Silian_value === null || Silian_value === undefined || Silian_value === '') return Silian_fallback;
  const Silian_num = Number(Silian_value);
  return Number.isFinite(Silian_num) ? Silian_num : Silian_fallback;
};

const Silian_slugify = (Silian_input) => {
  if (!Silian_input) return '';
  return Silian_input
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
};

const Silian_randomSlug = () => 'tag-' + Math.random().toString(36).slice(2, 8);

const Silian_normalizeCategory = (Silian_category) => {
  if (!Silian_category) {
    return null;
  }

  if (typeof Silian_category === 'string') {
    const Silian_name = Silian_category.trim();
    if (!Silian_name) {
      return null;
    }
    const Silian_slug = Silian_name.trim().toLowerCase();
    return {
      id: null,
      name: Silian_name,
      slug: Silian_slug || Silian_name,
    };
  }

  if (typeof Silian_category === 'object') {
    const Silian_idRaw =
      Silian_category.id ??
      Silian_category.category_id ??
      Silian_category.value ??
      Silian_category.key ??
      null;
    const Silian_id =
      Silian_idRaw !== null &&
      Silian_idRaw !== undefined &&
      Silian_idRaw !== '' &&
      !Number.isNaN(Number(Silian_idRaw))
        ? Number(Silian_idRaw)
        : null;

    const Silian_nameRaw =
      Silian_category.name ??
      Silian_category.category ??
      Silian_category.label ??
      Silian_category.value ??
      '';
    const Silian_name =
      typeof Silian_nameRaw === 'string' ? Silian_nameRaw.trim() : String(Silian_nameRaw || '').trim();

    const Silian_slugRaw =
      Silian_category.slug ??
      Silian_category.category_slug ??
      Silian_category.value ??
      '';
    let Silian_slug =
      typeof Silian_slugRaw === 'string' ? Silian_slugRaw.trim() : String(Silian_slugRaw || '').trim();
    if (!Silian_slug && Silian_name) {
      Silian_slug = Silian_name.trim();
    }
    if (Silian_slug) {
      Silian_slug = Silian_slug.toLowerCase();
    }
    if (!Silian_slug) {
      Silian_slug = Silian_randomSlug();
    }

    const Silian_fallbackSlug =
      typeof Silian_slugRaw === 'string' ? Silian_slugRaw.trim() : String(Silian_slugRaw || '').trim();
    const Silian_finalName = Silian_name || Silian_fallbackSlug || Silian_slug;

    if (!Silian_finalName) {
      return null;
    }

    return {
      id: Silian_id,
      name: Silian_finalName,
      slug: Silian_slug,
    };
  }

  return null;
};

const Silian_mapCategorySuggestions = (Silian_items) => {
  if (!Array.isArray(Silian_items)) return [];
  return Silian_items
    .map((Silian_item) => {
      const Silian_normalized = Silian_normalizeCategory(Silian_item);
      if (!Silian_normalized) return null;
      return {
        ...Silian_normalized,
        product_count: Silian_item?.product_count ?? Silian_item?.count ?? Silian_item?.total ?? 0,
      };
    })
    .filter(Boolean);
};

const Silian_normalizeTag = (Silian_tag) => {
  if (!Silian_tag) {
    return null;
  }
  if (typeof Silian_tag === 'string') {
    const Silian_name = Silian_tag.trim();
    if (!Silian_name) return null;
    return {
      id: null,
      name: Silian_name,
      slug: Silian_slugify(Silian_name) || Silian_randomSlug(),
    };
  }
  const Silian_name = Silian_tag.name?.trim() || Silian_tag.label?.trim() || Silian_tag.value?.trim() || '';
  if (!Silian_name) {
    return null;
  }
  const Silian_id = Silian_tag.id !== undefined && Silian_tag.id !== null && Silian_tag.id !== '' ? Number(Silian_tag.id) : null;
  const Silian_slug = Silian_slugify(Silian_tag.slug || Silian_name) || Silian_randomSlug();
  return { id: Silian_id, name: Silian_name, slug: Silian_slug };
};

const Silian_buildProductPayload = (Silian_form) => {
  const Silian_cleanName = (Silian_form.name || '').trim();
  const Silian_normalizedCategory = Silian_normalizeCategory(Silian_form.category);
  const Silian_normalizedTags = (Silian_form.tags || [])
    .map((Silian_item) => Silian_normalizeTag(Silian_item))
    .filter(Boolean)
    .reduce((Silian_acc, Silian_tag) => {
      const Silian_exists = Silian_acc.find((Silian_current) => {
        if (Silian_current.id && Silian_tag.id) {
          return Silian_current.id === Silian_tag.id;
        }
        return Silian_current.slug === Silian_tag.slug;
      });
      if (!Silian_exists) {
        Silian_acc.push(Silian_tag);
      }
      return Silian_acc;
    }, []);

  const Silian_imagesArray = Array.isArray(Silian_form.images) ? Silian_form.images.filter(Boolean) : [];

  return {
    name: Silian_cleanName,
    description: Silian_form.description || '',
    category: Silian_normalizedCategory
      ? { id: Silian_normalizedCategory.id, name: Silian_normalizedCategory.name, slug: Silian_normalizedCategory.slug }
      : null,
    points_required: Silian_sanitizeNumber(Silian_form.points_required),
    stock: Silian_sanitizeNumber(Silian_form.stock, -1),
    status: Silian_form.status || 'active',
    sort_order: Silian_sanitizeNumber(Silian_form.sort_order, 0),
    image_path: Silian_form.image_path || undefined,
    image_url: Silian_form.image_url || undefined,
    images: Silian_imagesArray.length ? Silian_imagesArray : undefined,
    tags: Silian_normalizedTags,
  };
};
export function ProductManagement() {
  const { t: Silian_t } = Silian_useTranslation(['admin', 'common', 'errors', 'images', 'pagination', 'products', 'validation']);
  const Silian_queryClient = Silian_useQueryClient();

  const [Silian_filters, Silian_setFilters] = Silian_useState({
    search: '',
    category: '',
    status: '',
    page: 1,
    limit: 10,
  });
  const [Silian_isModalOpen, Silian_setIsModalOpen] = Silian_useState(false);
  const [Silian_editingProduct, Silian_setEditingProduct] = Silian_useState(null);
  const [Silian_deleteDialog, Silian_setDeleteDialog] = Silian_useState({ open: false, product: null });

  const Silian_productsQuery = Silian_useQuery(
    ['adminProducts', Silian_filters],
    () => Silian_adminAPI.getProducts(Silian_filters).then((Silian_res) => Silian_res.data),
    { keepPreviousData: true }
  );

  const Silian_categoriesQuery = Silian_useQuery('productCategories', () => Silian_productAPI.getCategories().then((Silian_res) => Silian_res.data));

  const Silian_createProduct = Silian_useMutation((Silian_payload) => Silian_adminAPI.createProduct(Silian_payload));
  const Silian_updateProduct = Silian_useMutation(({ id: Silian_id, payload: Silian_payload }) => Silian_adminAPI.updateProduct(Silian_id, Silian_payload));
  const Silian_deleteProductMutation = Silian_useMutation((Silian_id) => Silian_adminAPI.deleteProduct(Silian_id));

  const Silian_isSubmitting = Silian_createProduct.isLoading || Silian_updateProduct.isLoading;

  const Silian_productsContainer = Silian_useMemo(
    () => (Silian_productsQuery.data?.data || Silian_productsQuery.data || {}),
    [Silian_productsQuery.data]
  );
  const Silian_products = Silian_useMemo(() => {
    const Silian_source = Silian_productsContainer.products || Silian_productsContainer.data || Silian_productsQuery.data || [];
    return Array.isArray(Silian_source) ? Silian_source : [];
  }, [Silian_productsContainer, Silian_productsQuery.data]);
  const Silian_pagination = Silian_productsContainer.pagination || {
    page: Silian_filters.page,
    limit: Silian_filters.limit,
    total: Silian_products.length,
    pages: 1,
    current_page: Silian_filters.page,
    per_page: Silian_filters.limit,
    total_items: Silian_products.length,
    total_pages: 1,
  };

  const Silian_categories = Silian_useMemo(() => {
    const Silian_dataPayload = Silian_categoriesQuery.data?.data;
    const Silian_source = Array.isArray(Silian_dataPayload?.categories)
      ? Silian_dataPayload.categories
      : Array.isArray(Silian_dataPayload)
        ? Silian_dataPayload
        : Silian_categoriesQuery.data?.categories || [];
    if (!Array.isArray(Silian_source)) return [];
    return Silian_mapCategorySuggestions(Silian_source);
  }, [Silian_categoriesQuery.data]);

  Silian_useEffect(() => {
    const Silian_paths = Silian_products
      .map((Silian_product) => {
        const Silian_images = Array.isArray(Silian_product.images) ? Silian_product.images : [];
        const Silian_firstImage = Silian_images.length > 0 ? Silian_images[0] : null;

        const Silian_firstImagePath = (() => {
          if (!Silian_firstImage) return null;
          if (typeof Silian_firstImage === 'string') {
            return Silian_firstImage.indexOf('http') === 0 ? null : Silian_firstImage;
          }
          if (typeof Silian_firstImage === 'object' && Silian_firstImage !== null) {
            if (Silian_firstImage.file_path) {
              return Silian_firstImage.file_path;
            }
            if (typeof Silian_firstImage.url === 'string' && Silian_firstImage.url.indexOf('http') !== 0) {
              return Silian_firstImage.url;
            }
          }
          return null;
        })();

        const Silian_candidateFilePath = Silian_product.image_path
          || Silian_firstImagePath
          || (typeof Silian_product.image_url === 'string' && Silian_product.image_url.indexOf('http') !== 0 ? Silian_product.image_url : null);

        const Silian_hasInlineUrl =
          (typeof Silian_product.image_url === 'string' && Silian_product.image_url.indexOf('http') === 0 && Silian_product.image_url) ||
          (typeof Silian_product.image_presigned_url === 'string' && Silian_product.image_presigned_url) ||
          (Silian_firstImage && typeof Silian_firstImage === 'string' && Silian_firstImage.indexOf('http') === 0 && Silian_firstImage) ||
          (Silian_firstImage && typeof Silian_firstImage === 'object' && Silian_firstImage !== null && typeof Silian_firstImage.url === 'string' && Silian_firstImage.url.indexOf('http') === 0 && Silian_firstImage.url) ||
          (Silian_firstImage && typeof Silian_firstImage === 'object' && Silian_firstImage !== null && typeof Silian_firstImage.presigned_url === 'string' && Silian_firstImage.presigned_url);

        if (!Silian_candidateFilePath || Silian_hasInlineUrl) {
          return null;
        }

        return Silian_candidateFilePath;
      })
      .filter(Boolean);

    if (Silian_paths.length) {
      Silian_prefetchPresignedUrls(Silian_paths).catch(() => {});
    }
  }, [Silian_products]);

  const Silian_handleFilterChange = (Silian_key, Silian_value) => {
    Silian_setFilters((Silian_prev) => ({ ...Silian_prev, [Silian_key]: Silian_value, page: 1 }));
  };

  const Silian_handlePageChange = (Silian_page) => {
    Silian_setFilters((Silian_prev) => ({ ...Silian_prev, page: Silian_page }));
  };

  const Silian_handleCloseModal = () => {
    Silian_setIsModalOpen(false);
    Silian_setEditingProduct(null);
  };

  const Silian_openCreateModal = () => {
    Silian_setEditingProduct(null);
    Silian_setIsModalOpen(true);
  };

  const Silian_openEditModal = (Silian_product) => {
    Silian_setEditingProduct(Silian_product);
    Silian_setIsModalOpen(true);
  };

  const Silian_handleDeleteConfirm = () => {
    if (!Silian_deleteDialog.product) return;
    Silian_deleteProductMutation.mutate(Silian_deleteDialog.product.id, {
      onSuccess: () => {
        Silian_toast.success(Silian_t('admin.products.deleteSuccess'));
        Silian_queryClient.invalidateQueries('adminProducts');
      },
      onError: () => {
        Silian_toast.error(Silian_t('admin.products.deleteFailed'));
      },
      onSettled: () => Silian_setDeleteDialog({ open: false, product: null }),
    });
  };

  const Silian_handleSubmit = Silian_useCallback(
    (Silian_formValues) => {
      const Silian_payload = Silian_buildProductPayload(Silian_formValues);
      if (Silian_editingProduct) {
        Silian_updateProduct.mutate(
          { id: Silian_editingProduct.id, payload: Silian_payload },
          {
            onSuccess: () => {
              Silian_toast.success(Silian_t('admin.products.updateSuccess'));
              Silian_queryClient.invalidateQueries('adminProducts');
              Silian_handleCloseModal();
            },
            onError: () => {
              Silian_toast.error(Silian_t('admin.products.updateFailed'));
            },
          }
        );
        return;
      }

      Silian_createProduct.mutate(Silian_payload, {
        onSuccess: () => {
          Silian_toast.success(Silian_t('admin.products.createSuccess'));
          Silian_queryClient.invalidateQueries('adminProducts');
          Silian_handleCloseModal();
        },
        onError: () => {
          Silian_toast.error(Silian_t('admin.products.createFailed'));
        },
      });
    },
    [Silian_createProduct, Silian_editingProduct, Silian_queryClient, Silian_t, Silian_updateProduct]
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{Silian_t('admin.products.title')}</h2>
        <p className="text-muted-foreground">{Silian_t('admin.products.description')}</p>
      </div>

      <div className="bg-card rounded-lg border p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">{Silian_t('common.search')}</label>
              <div className="relative">
                <Silian_Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
                <Silian_Input
                  value={Silian_filters.search}
                  onChange={(Silian_event) => Silian_handleFilterChange('search', Silian_event.target.value)}
                  placeholder={Silian_t('admin.products.searchPlaceholder')}
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">{Silian_t('admin.products.category')}</label>
              <select
                value={Silian_filters.category}
                onChange={(Silian_event) => Silian_handleFilterChange('category', Silian_event.target.value)}
                className="bg-background mt-0 block w-full rounded-md border border-input px-3 py-2 text-foreground focus:border-emerald-500 focus:outline-none focus:ring-emerald-500"
              >
                <option value="">{Silian_t('common.all')}</option>
                {Silian_categories.map((Silian_category) => (
                  <option
                    key={Silian_category.slug || Silian_category.id || Silian_category.name}
                    value={Silian_category.slug || Silian_category.id || Silian_category.name}
                  >
                    {Silian_category.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">{Silian_t('admin.products.status')}</label>
              <select
                value={Silian_filters.status}
                onChange={(Silian_event) => Silian_handleFilterChange('status', Silian_event.target.value)}
                className="bg-background mt-0 block w-full rounded-md border border-input px-3 py-2 text-foreground focus:border-emerald-500 focus:outline-none focus:ring-emerald-500"
              >
                <option value="">{Silian_t('common.all')}</option>
                {Silian_STATUS_OPTIONS.map((Silian_option) => (
                  <option key={Silian_option.value} value={Silian_option.value}>
                    {Silian_t(Silian_option.labelKey)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <Silian_Button onClick={Silian_openCreateModal} className="shrink-0">
            <Silian_PlusCircle className="mr-2 h-4 w-4" />
            {Silian_t('admin.products.addProduct')}
          </Silian_Button>
        </div>
      </div>
      {Silian_productsQuery.isLoading || Silian_productsQuery.isFetching ? (
        <div className="flex h-64 items-center justify-center">
          <Silian_Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        </div>
      ) : Silian_productsQuery.error ? (
        <Silian_Alert variant="destructive">
          <Silian_AlertTitle>{Silian_t('common.error')}</Silian_AlertTitle>
          <Silian_AlertDescription>{Silian_t('errors.loadFailed')}</Silian_AlertDescription>
        </Silian_Alert>
      ) : Silian_products.length === 0 ? (
        <div className="bg-card rounded-lg border p-16 text-center shadow-sm">
          <h3 className="text-xl font-semibold">{Silian_t('admin.products.noProductsFound')}</h3>
          <p className="mt-2 text-muted-foreground">{Silian_t('admin.products.tryDifferentFilters')}</p>
        </div>
      ) : (
        <>
          <div className="bg-card overflow-x-auto rounded-lg border shadow-sm">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-muted-foreground px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    {Silian_t('admin.products.table.image')}
                  </th>
                  <th className="text-muted-foreground px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    {Silian_t('admin.products.table.name')}
                  </th>
                  <th className="text-muted-foreground px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    {Silian_t('admin.products.table.category')}
                  </th>
                  <th className="text-muted-foreground px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    {Silian_t('admin.products.table.price')}
                  </th>
                  <th className="text-muted-foreground px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    {Silian_t('admin.products.table.stock')}
                  </th>
                  <th className="text-muted-foreground px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    {Silian_t('admin.products.table.tags')}
                  </th>
                  <th className="text-muted-foreground px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    {Silian_t('admin.products.table.status')}
                  </th>
                  <th className="text-muted-foreground px-6 py-3 text-right text-xs font-medium uppercase tracking-wider">
                    {Silian_t('admin.products.table.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-border">
                {Silian_products.map((Silian_product) => {
                  const Silian_price = Silian_product.points_required !== undefined && Silian_product.points_required !== null ? Silian_product.points_required : Silian_product.price || 0;
                  const Silian_isOutOfStock = Silian_product.stock === 0;
                  const Silian_unlimited = Silian_product.stock === -1;
                  const Silian_images = Array.isArray(Silian_product.images) ? Silian_product.images : [];
                  const Silian_firstImage = Silian_images.length > 0 ? Silian_images[0] : null;

                  const Silian_firstImagePath = (() => {
                    if (!Silian_firstImage) return null;
                    if (typeof Silian_firstImage === 'string') {
                      return Silian_firstImage.indexOf('http') === 0 ? null : Silian_firstImage;
                    }
                    if (typeof Silian_firstImage === 'object' && Silian_firstImage !== null) {
                      if (Silian_firstImage.file_path) {
                        return Silian_firstImage.file_path;
                      }
                      if (typeof Silian_firstImage.url === 'string' && Silian_firstImage.url.indexOf('http') !== 0) {
                        return Silian_firstImage.url;
                      }
                    }
                    return null;
                  })();

                  const Silian_candidateFilePath = Silian_product.image_path
                    || Silian_firstImagePath
                    || (typeof Silian_product.image_url === 'string' && Silian_product.image_url.indexOf('http') !== 0 ? Silian_product.image_url : null);

                  const Silian_presignedFromProduct = typeof Silian_product.image_presigned_url === 'string' && Silian_product.image_presigned_url ? Silian_product.image_presigned_url : null;
                  const Silian_presignedFromImage = Silian_firstImage && typeof Silian_firstImage === 'object' && Silian_firstImage !== null && typeof Silian_firstImage.presigned_url === 'string' && Silian_firstImage.presigned_url
                    ? Silian_firstImage.presigned_url
                    : null;

                  const Silian_httpImageCandidates = [
                    typeof Silian_product.image_url === 'string' && Silian_product.image_url.indexOf('http') === 0 ? Silian_product.image_url : null,
                    Silian_firstImage && typeof Silian_firstImage === 'string' && Silian_firstImage.indexOf('http') === 0 ? Silian_firstImage : null,
                    Silian_firstImage && typeof Silian_firstImage === 'object' && Silian_firstImage !== null && typeof Silian_firstImage.url === 'string' && Silian_firstImage.url.indexOf('http') === 0 ? Silian_firstImage.url : null,
                    Silian_presignedFromProduct,
                    Silian_presignedFromImage,
                  ];

                  const Silian_resolvedImageSrc = Silian_httpImageCandidates.find((Silian_value) => typeof Silian_value === 'string' && Silian_value) || null;
                  const Silian_imageFilePath = Silian_candidateFilePath || null;

                  return (
                    <tr key={Silian_product.id}>
                      <td className="px-6 py-4">
                        {Silian_imageFilePath || Silian_resolvedImageSrc ? (
                          <Silian_R2Image
                            filePath={Silian_imageFilePath || undefined}
                            src={Silian_resolvedImageSrc || undefined}
                            alt={Silian_product.name}
                            className="h-12 w-12 rounded-lg object-cover"
                            fallback={<div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground">IMG</div>}
                          />
                        ) : (
                          <Silian_ImageIcon className="h-10 w-10 text-muted-foreground/50" />
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-foreground">{Silian_product.name}</div>
                        <div className="text-sm text-muted-foreground">{Silian_product.description}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{Silian_product.category || Silian_t('admin.products.form.uncategorized')}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-green-600">
                        {Silian_formatNumber(Silian_price, 0)} {Silian_t('common.points')}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {Silian_unlimited ? Silian_t('admin.products.unlimited') : Silian_formatNumber(Silian_product.stock, 0)}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        <div className="flex flex-wrap gap-1">
                          {(Silian_product.tags || []).map((Silian_tag) => {
                            const Silian_keyValue = String(Silian_product.id || 'product') + '-' + String(Silian_tag.id !== undefined && Silian_tag.id !== null ? Silian_tag.id : Silian_tag.slug || Silian_tag.name || 'tag');
                            return (
                              <Silian_Badge key={Silian_keyValue} variant="secondary" className="uppercase">
                                {Silian_tag.name}
                              </Silian_Badge>
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {Silian_isOutOfStock ? (
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${Silian_PRODUCT_STATUS_BADGE_STYLES.outOfStock}`}>
                            {Silian_t('admin.products.statusOutOfStock')}
                          </span>
                        ) : Silian_product.status === 'active' ? (
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${Silian_PRODUCT_STATUS_BADGE_STYLES.active}`}>
                            {Silian_t('admin.products.statusActive')}
                          </span>
                        ) : (
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${Silian_PRODUCT_STATUS_BADGE_STYLES.inactive}`}>
                            {Silian_t('admin.products.statusInactive')}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-medium">
                        <Silian_Button variant="ghost" size="sm" onClick={() => Silian_openEditModal(Silian_product)} className="mr-2">
                          <Silian_Edit className="h-4 w-4" />
                        </Silian_Button>
                        <Silian_Button
                          variant="ghost"
                          size="sm"
                          onClick={() => Silian_setDeleteDialog({ open: true, product: Silian_product })}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Silian_Trash2 className="h-4 w-4" />
                        </Silian_Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Silian_Pagination
            currentPage={Silian_pagination.current_page || Silian_pagination.page}
            totalPages={Silian_pagination.total_pages || Silian_pagination.pages || 1}
            onPageChange={Silian_handlePageChange}
            itemsPerPage={Silian_pagination.per_page || Silian_pagination.limit}
            totalItems={Silian_pagination.total_items || Silian_pagination.total}
          />
        </>
      )}
      <Silian_AlertDialog open={Silian_deleteDialog.open} onOpenChange={(Silian_open) => (!Silian_open ? Silian_setDeleteDialog({ open: false, product: null }) : null)}>
        <Silian_AlertDialogContent className="sm:max-w-md">
          <Silian_AlertDialogHeader>
            <Silian_AlertDialogTitle>{Silian_t('admin.products.deleteTitle')}</Silian_AlertDialogTitle>
            <Silian_AlertDialogDescription>
              {Silian_t('admin.products.confirmDelete', {
                name: Silian_deleteDialog.product?.name || Silian_t('admin.products.unnamed'),
              })}
            </Silian_AlertDialogDescription>
          </Silian_AlertDialogHeader>
          <Silian_AlertDialogFooter>
            <Silian_AlertDialogCancel onClick={() => Silian_setDeleteDialog({ open: false, product: null })}>
              {Silian_t('common.cancel')}
            </Silian_AlertDialogCancel>
            <Silian_AlertDialogAction
              onClick={Silian_handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700 focus-visible:ring-red-600"
              disabled={Silian_deleteProductMutation.isLoading}
            >
              {Silian_deleteProductMutation.isLoading ? <Silian_Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Silian_Trash2 className="mr-2 h-4 w-4" />}
              {Silian_t('common.confirm')}
            </Silian_AlertDialogAction>
          </Silian_AlertDialogFooter>
        </Silian_AlertDialogContent>
      </Silian_AlertDialog>

      {Silian_isModalOpen && (
        <Silian_ProductFormModal
          isOpen={Silian_isModalOpen}
          onClose={Silian_handleCloseModal}
          onSubmit={Silian_handleSubmit}
          product={Silian_editingProduct}
          categories={Silian_categories}
          isSubmitting={Silian_isSubmitting}
          t={Silian_t}
        />
      )}
    </div>
  );
}

function Silian_ProductFormModal({ isOpen: Silian_isOpen, onClose: Silian_onClose, onSubmit: Silian_onSubmit, product: Silian_product, categories: Silian_categories, isSubmitting: Silian_isSubmitting, t: Silian_t }) {
  const [Silian_formValues, Silian_setFormValues] = Silian_useState(Silian_DEFAULT_FORM);
  const [Silian_uploading, Silian_setUploading] = Silian_useState(false);
  const Silian_fileInputRef = Silian_useRef(null);

  Silian_useEffect(() => {
    if (!Silian_isOpen) {
      Silian_setFormValues(Silian_DEFAULT_FORM);
      return;
    }

    if (Silian_product) {
      const Silian_firstImage = Array.isArray(Silian_product.images) && Silian_product.images.length ? Silian_product.images[0] : null;
      Silian_setFormValues({
        name: Silian_product.name || '',
        description: Silian_product.description || '',
        category: Silian_normalizeCategory({
          id: Silian_product.category_id ?? Silian_product.categoryId ?? null,
          name: Silian_product.category ?? '',
          slug: Silian_product.category_slug ?? Silian_product.categorySlug ?? '',
        }),
        points_required: Silian_product.points_required !== undefined && Silian_product.points_required !== null ? Silian_product.points_required : Silian_product.price || 0,
        stock: Silian_product.stock !== undefined && Silian_product.stock !== null ? Silian_product.stock : -1,
        status: Silian_product.status || 'active',
        sort_order: Silian_product.sort_order !== undefined && Silian_product.sort_order !== null ? Silian_product.sort_order : 0,
        image_path: Silian_product.image_path || (typeof Silian_product.image_url === 'string' && Silian_product.image_url.indexOf('http') !== 0 ? Silian_product.image_url : '') || Silian_firstImage?.file_path || '',
        image_url: typeof Silian_product.image_url === 'string' ? Silian_product.image_url : (Silian_firstImage?.url || ''),
        image_presigned_url: Silian_product.image_presigned_url || Silian_firstImage?.presigned_url || '',
        images: Array.isArray(Silian_product.images) ? Silian_product.images : [],
        tags: Array.isArray(Silian_product.tags)
          ? Silian_product.tags.map((Silian_tag) => ({ id: Silian_tag.id !== undefined ? Silian_tag.id : null, name: Silian_tag.name, slug: Silian_tag.slug || Silian_slugify(Silian_tag.name) }))
          : [],
      });
    } else {
      Silian_setFormValues(Silian_DEFAULT_FORM);
    }
  }, [Silian_isOpen, Silian_product]);

  const Silian_handleChange = (Silian_field) => (Silian_event) => {
    Silian_setFormValues((Silian_prev) => ({ ...Silian_prev, [Silian_field]: Silian_event.target.value }));
  };

  const Silian_handleTagChange = (Silian_nextTags) => {
    Silian_setFormValues((Silian_prev) => ({ ...Silian_prev, tags: Silian_nextTags }));
  };

  const Silian_handleCategoryChange = (Silian_nextCategory) => {
    Silian_setFormValues((Silian_prev) => ({ ...Silian_prev, category: Silian_normalizeCategory(Silian_nextCategory) }));
  };

  const Silian_handleImageUpload = async (Silian_event) => {
    const Silian_file = Silian_event.target.files && Silian_event.target.files[0];
    if (!Silian_file) return;
    if (Silian_file.size > 5 * 1024 * 1024) {
      Silian_toast.error(Silian_t('admin.products.form.fileTooLarge'));
      Silian_event.target.value = '';
      return;
    }

    Silian_setUploading(true);
    try {
      const Silian_result = await Silian_uploadViaPresign(Silian_file, {
        directory: 'products',
        entityType: 'product',
        entityId: Silian_product ? Silian_product.id : undefined,
      });

      let Silian_previewUrl = Silian_result.url || Silian_result.public_url || Silian_result.presigned_url || '';
      if (!Silian_previewUrl && Silian_result.file_path) {
        try {
          Silian_previewUrl = await Silian_getPresignedReadUrl(Silian_result.file_path, 600);
        } catch (Silian_error) {
          console.warn('Preview presign failed', Silian_error);
        }
      }

      const Silian_storedUrl = Silian_result.public_url || Silian_result.url || '';
      const Silian_imageData = {
        file_path: Silian_result.file_path,
        url: Silian_storedUrl,
        presigned_url: Silian_result.presigned_url || (Silian_previewUrl || null),
        thumbnail_path: Silian_result.thumbnail_path || null,
      };

      Silian_setFormValues((Silian_prev) => ({
        ...Silian_prev,
        image_path: Silian_result.file_path || Silian_prev.image_path,
        image_url: Silian_storedUrl,
        image_presigned_url: Silian_imageData.presigned_url || '',
        images: [Silian_imageData],
      }));
      Silian_toast.success(Silian_t('admin.products.form.uploadSuccess'));
    } catch (Silian_error) {
      console.error('Product image upload failed', Silian_error);
      Silian_toast.error(Silian_t('admin.products.form.uploadFailed'));
    } finally {
      Silian_setUploading(false);
      if (Silian_event.target) {
        Silian_event.target.value = '';
      }
    }
  };

  const Silian_handleRemoveImage = () => {
    Silian_setFormValues((Silian_prev) => ({ ...Silian_prev, image_path: '', image_url: '', image_presigned_url: '', images: [] }));
  };

  const Silian_handleSubmit = (Silian_event) => {
    Silian_event.preventDefault();
    const Silian_trimmedName = (Silian_formValues.name || '').trim();
    if (!Silian_trimmedName) {
      Silian_toast.error(Silian_t('validation.required'));
      return;
    }
    const Silian_nextValues = Silian_trimmedName === Silian_formValues.name ? Silian_formValues : { ...Silian_formValues, name: Silian_trimmedName };
    Silian_onSubmit(Silian_nextValues);
  };

  const Silian_previewSource = Silian_formValues.image_url || Silian_formValues.image_presigned_url || '';
  const Silian_imagePath = Silian_formValues.image_path || (Silian_previewSource && Silian_previewSource.indexOf('http') !== 0 ? Silian_previewSource : '');
  const Silian_externalImage = !Silian_imagePath && Silian_previewSource && Silian_previewSource.indexOf('http') === 0 ? Silian_previewSource : '';

  return (
    <Silian_Dialog open={Silian_isOpen} onOpenChange={(Silian_open) => (!Silian_open ? Silian_onClose() : null)}>
      <Silian_DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <Silian_DialogHeader>
          <Silian_DialogTitle>{Silian_product ? Silian_t('admin.products.editProduct') : Silian_t('admin.products.addProduct')}</Silian_DialogTitle>
          <Silian_DialogDescription>{Silian_t('admin.products.formModal.description')}</Silian_DialogDescription>
        </Silian_DialogHeader>
        <form onSubmit={Silian_handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label htmlFor="product-name" className="block text-sm font-medium text-foreground">
                {Silian_t('admin.products.form.name')}
              </label>
              <Silian_Input
                id="product-name"
                value={Silian_formValues.name}
                onChange={Silian_handleChange('name')}
                required
              />
            </div>
            <div>
              <Silian_ProductCategorySelector
                value={Silian_formValues.category}
                onChange={Silian_handleCategoryChange}
                initialCategories={Silian_categories}
                t={Silian_t}
              />
            </div>
            <div>
              <label htmlFor="product-status" className="block text-sm font-medium text-foreground">
                {Silian_t('admin.products.form.status')}
              </label>
              <select
                id="product-status"
                value={Silian_formValues.status}
                onChange={Silian_handleChange('status')}
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-foreground focus:border-emerald-500 focus:outline-none focus:ring-emerald-500"
              >
                {Silian_STATUS_OPTIONS.map((Silian_option) => (
                  <option key={Silian_option.value} value={Silian_option.value}>
                    {Silian_t(Silian_option.labelKey)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="product-points" className="block text-sm font-medium text-foreground">
                {Silian_t('admin.products.form.pointsRequired')}
              </label>
              <Silian_Input
                id="product-points"
                type="number"
                min={0}
                value={Silian_formValues.points_required}
                onChange={Silian_handleChange('points_required')}
                required
              />
            </div>
            <div>
              <label htmlFor="product-stock" className="block text-sm font-medium text-foreground">
                {Silian_t('admin.products.form.stock')}
              </label>
              <Silian_Input
                id="product-stock"
                type="number"
                value={Silian_formValues.stock}
                onChange={Silian_handleChange('stock')}
              />
              <p className="mt-1 text-xs text-muted-foreground">{Silian_t('admin.products.form.stockHint')}</p>
            </div>
            <div>
              <label htmlFor="product-sort-order" className="block text-sm font-medium text-foreground">
                {Silian_t('admin.products.form.sortOrder')}
              </label>
              <Silian_Input
                id="product-sort-order"
                type="number"
                value={Silian_formValues.sort_order}
                onChange={Silian_handleChange('sort_order')}
              />
            </div>
          </div>

          <div>
            <label htmlFor="product-description" className="block text-sm font-medium text-foreground">
              {Silian_t('admin.products.form.description')}
            </label>
            <Silian_Textarea
              id="product-description"
              value={Silian_formValues.description}
              onChange={Silian_handleChange('description')}
              className="min-h-[120px]"
            />
          </div>

          <div>
            <Silian_ProductTagSelector value={Silian_formValues.tags} onChange={Silian_handleTagChange} t={Silian_t} />
          </div>

          <div>
            <span className="block text-sm font-medium text-foreground">{Silian_t('admin.products.form.image')}</span>
            <div className="mt-2 flex items-center gap-4">
              {Silian_imagePath || Silian_externalImage ? (
                <Silian_R2Image
                  filePath={Silian_imagePath || undefined}
                  src={Silian_externalImage || undefined}
                  alt={Silian_formValues.name || 'product'}
                  className="h-20 w-20 rounded-lg object-cover"
                  fallback={<div className="flex h-20 w-20 items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground">IMG</div>}
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed border-border bg-muted/40 text-muted-foreground">
                  <Silian_ImageIcon className="h-6 w-6" />
                </div>
              )}
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <Silian_Button
                    type="button"
                    variant="outline"
                    onClick={() => Silian_fileInputRef.current && Silian_fileInputRef.current.click()}
                    disabled={Silian_uploading || Silian_isSubmitting}
                  >
                    {Silian_uploading ? <Silian_Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Silian_PlusCircle className="mr-2 h-4 w-4" />}
                    {Silian_uploading ? Silian_t('admin.products.form.uploading') : Silian_t('admin.products.form.chooseImage')}
                  </Silian_Button>
                  {(Silian_imagePath || Silian_externalImage) && (
                    <Silian_Button type="button" variant="ghost" onClick={Silian_handleRemoveImage} disabled={Silian_isSubmitting}>
                      <Silian_X className="mr-2 h-4 w-4" />
                      {Silian_t('admin.products.form.removeImage')}
                    </Silian_Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{Silian_t('admin.products.form.imageHint')}</p>
              </div>
            </div>
            <input
              ref={Silian_fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={Silian_handleImageUpload}
            />
          </div>

          <Silian_DialogFooter>
            <Silian_Button type="button" variant="outline" onClick={Silian_onClose} disabled={Silian_isSubmitting || Silian_uploading}>
              {Silian_t('common.cancel')}
            </Silian_Button>
            <Silian_Button type="submit" disabled={Silian_isSubmitting || Silian_uploading}>
              {Silian_isSubmitting ? <Silian_Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {Silian_isSubmitting ? Silian_t('common.saving') : Silian_t('common.save')}
            </Silian_Button>
          </Silian_DialogFooter>
        </form>
      </Silian_DialogContent>
    </Silian_Dialog>
  );
}
function Silian_ProductCategorySelector({ value: Silian_value, onChange: Silian_onChange, initialCategories: Silian_initialCategories = [], t: Silian_t }) {
  const [Silian_query, Silian_setQuery] = Silian_useState('');
  const Silian_inputId = Silian_useMemo(() => 'product-category-input-' + Math.random().toString(36).slice(2, 8), []);
  const [Silian_suggestions, Silian_setSuggestions] = Silian_useState(() => Silian_mapCategorySuggestions(Silian_initialCategories));
  const [Silian_loading, Silian_setLoading] = Silian_useState(false);
  const Silian_debounceRef = Silian_useRef(null);

  const Silian_normalizedValue = Silian_normalizeCategory(Silian_value);

  Silian_useEffect(() => {
    const Silian_incoming = Silian_mapCategorySuggestions(Silian_initialCategories);
    if (!Silian_incoming.length) {
      return;
    }
    Silian_setSuggestions((Silian_prev) => {
      const Silian_map = new Map();
      Silian_incoming.forEach((Silian_item) => {
        const Silian_key = (Silian_item.slug || Silian_item.name || '').toLowerCase();
        if (Silian_key) {
          Silian_map.set(Silian_key, Silian_item);
        }
      });
      Silian_prev.forEach((Silian_item) => {
        if (!Silian_item) return;
        const Silian_key = (Silian_item.slug || Silian_item.name || '').toLowerCase();
        if (Silian_key && !Silian_map.has(Silian_key)) {
          Silian_map.set(Silian_key, Silian_item);
        }
      });
      return Array.from(Silian_map.values());
    });
  }, [Silian_initialCategories]);

  const Silian_loadSuggestions = Silian_useCallback(async (Silian_term) => {
    Silian_setLoading(true);
    try {
      const Silian_response = await Silian_productAPI.getCategories({ search: Silian_term || '', limit: 12 });
      const Silian_payload = Silian_response.data?.data;
      const Silian_items = Array.isArray(Silian_payload?.categories)
        ? Silian_payload.categories
        : Array.isArray(Silian_payload)
          ? Silian_payload
          : Silian_response.data?.categories || [];
      Silian_setSuggestions(Silian_mapCategorySuggestions(Silian_items));
    } catch (Silian_error) {
      console.error('Category search failed', Silian_error);
    } finally {
      Silian_setLoading(false);
    }
  }, []);

  Silian_useEffect(() => {
    Silian_loadSuggestions('');
  }, [Silian_loadSuggestions]);

  Silian_useEffect(() => {
    if (Silian_debounceRef.current) {
      clearTimeout(Silian_debounceRef.current);
    }
    Silian_debounceRef.current = setTimeout(() => {
      Silian_loadSuggestions(Silian_query.trim());
    }, 250);
    return () => {
      if (Silian_debounceRef.current) {
        clearTimeout(Silian_debounceRef.current);
      }
    };
  }, [Silian_query, Silian_loadSuggestions]);

  const Silian_handleSelect = Silian_useCallback((Silian_category) => {
    const Silian_normalized = Silian_normalizeCategory(Silian_category);
    if (!Silian_normalized) return;
    if (typeof Silian_onChange === 'function') {
      Silian_onChange(Silian_normalized);
    }
    Silian_setQuery('');
  }, [Silian_onChange]);

  const Silian_handleCreate = Silian_useCallback(() => {
    const Silian_trimmed = Silian_query.trim();
    if (!Silian_trimmed) return;
    Silian_handleSelect({ name: Silian_trimmed });
  }, [Silian_query, Silian_handleSelect]);

  const Silian_handleClear = Silian_useCallback(() => {
    if (typeof Silian_onChange === 'function') {
      Silian_onChange(null);
    }
  }, [Silian_onChange]);

  return (
    <div>
      <label htmlFor={Silian_inputId} className="block text-sm font-medium text-foreground">{Silian_t('admin.products.form.category')}</label>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {Silian_normalizedValue ? (
          <Silian_Badge variant="secondary" className="flex items-center gap-1">
            <span>{Silian_normalizedValue.name}</span>
            <button
              type="button"
              className="rounded-full p-0.5 hover:bg-muted"
              onClick={Silian_handleClear}
              aria-label={Silian_t('admin.products.form.removeCategory')}
            >
              <Silian_X className="h-3 w-3" />
            </button>
          </Silian_Badge>
        ) : (
          <span className="text-xs text-muted-foreground">{Silian_t('admin.products.form.categoryPlaceholder')}</span>
        )}
      </div>
      <div className="mt-3 flex gap-2">
        <Silian_Input
          id={Silian_inputId}
          value={Silian_query}
          onChange={(Silian_event) => Silian_setQuery(Silian_event.target.value)}
          onKeyDown={(Silian_event) => {
            if (Silian_event.key === 'Enter') {
              Silian_event.preventDefault();
              Silian_handleCreate();
            }
          }}
          placeholder={Silian_t('admin.products.form.categorySearchPlaceholder')}
        />
        <Silian_Button type="button" variant="outline" onClick={Silian_handleCreate} disabled={!Silian_query.trim()}>
          {Silian_t('admin.products.form.useCategory')}
        </Silian_Button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {Silian_t('admin.products.form.categoryHint')}
      </p>
      <div className="mt-3 rounded-md border border-border bg-muted/40">
        <div className="flex items-center justify-between border-b border-border px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <span>{Silian_t('admin.products.form.suggestions')}</span>
          {Silian_loading ? <Silian_Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-500" /> : null}
        </div>
        <div className="max-h-44 overflow-y-auto">
          {Silian_suggestions.length === 0 && !Silian_loading ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              {Silian_t('admin.products.form.noCategorySuggestions')}
            </div>
          ) : (
            Silian_suggestions.map((Silian_item) => {
              const Silian_key = `category-suggestion-${Silian_item.slug || Silian_item.id || Silian_item.name}`;
              const Silian_isActive =
                Silian_normalizedValue &&
                (Silian_normalizedValue.slug === Silian_item.slug || Silian_normalizedValue.name === Silian_item.name);
              return (
                <button
                  type="button"
                  key={Silian_key}
                  onClick={() => Silian_handleSelect(Silian_item)}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors hover:bg-background ${Silian_isActive ? 'bg-background' : ''}`}
                >
                  <span>{Silian_item.name}</span>
                  <span className="text-xs uppercase text-muted-foreground">
                    {Silian_item.product_count !== undefined && Silian_item.product_count !== null ? Silian_item.product_count : Silian_item.slug}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function Silian_ProductTagSelector({ value: Silian_value, onChange: Silian_onChange, t: Silian_t }) {
  const [Silian_query, Silian_setQuery] = Silian_useState('');
  const [Silian_suggestions, Silian_setSuggestions] = Silian_useState([]);
  const [Silian_loading, Silian_setLoading] = Silian_useState(false);
  const Silian_debounceRef = Silian_useRef(null);

  const Silian_loadSuggestions = Silian_useCallback(async (Silian_term) => {
    Silian_setLoading(true);
    try {
      const Silian_response = await Silian_adminAPI.searchProductTags({ search: Silian_term || '', limit: 12 });
      Silian_setSuggestions(Silian_response.data?.data?.tags || []);
    } catch (Silian_error) {
      console.error('Tag search failed', Silian_error);
    } finally {
      Silian_setLoading(false);
    }
  }, []);

  Silian_useEffect(() => {
    Silian_loadSuggestions('');
  }, [Silian_loadSuggestions]);

  Silian_useEffect(() => {
    if (Silian_debounceRef.current) {
      clearTimeout(Silian_debounceRef.current);
    }
    Silian_debounceRef.current = setTimeout(() => {
      Silian_loadSuggestions(Silian_query.trim());
    }, 250);
    return () => {
      if (Silian_debounceRef.current) {
        clearTimeout(Silian_debounceRef.current);
      }
    };
  }, [Silian_query, Silian_loadSuggestions]);

  const Silian_addTag = (Silian_tag) => {
    const Silian_normalized = Silian_normalizeTag(Silian_tag);
    if (!Silian_normalized) return;
    const Silian_exists = (Silian_value || []).some((Silian_item) => {
      if (Silian_item.id && Silian_normalized.id) {
        return Silian_item.id === Silian_normalized.id;
      }
      return Silian_item.slug === Silian_normalized.slug;
    });
    if (!Silian_exists) {
      Silian_onChange([].concat(Silian_value || [], [Silian_normalized]));
    }
  };

  const Silian_handleInputAdd = () => {
    const Silian_trimmed = Silian_query.trim();
    if (!Silian_trimmed) return;
    const Silian_match = Silian_suggestions.find((Silian_item) => (Silian_item.name || '').toLowerCase() === Silian_trimmed.toLowerCase());
    Silian_addTag(Silian_match || Silian_trimmed);
    Silian_setQuery('');
  };

  const Silian_handleRemove = (Silian_index) => {
    const Silian_next = (Silian_value || []).slice();
    Silian_next.splice(Silian_index, 1);
    Silian_onChange(Silian_next);
  };

  return (
    <div>
      <label className="block text-sm font-medium text-foreground">{Silian_t('admin.products.form.tags')}</label>
      <div className="mt-2 flex flex-wrap gap-2">
        {(Silian_value || []).map((Silian_tag, Silian_index) => {
          const Silian_keyValue = 'selected-tag-' + Silian_index + '-' + (Silian_tag.id !== undefined && Silian_tag.id !== null ? Silian_tag.id : Silian_tag.slug || Silian_tag.name || 'tag');
          return (
            <Silian_Badge key={Silian_keyValue} variant="secondary" className="flex items-center gap-1 uppercase">
              <span>{Silian_tag.name}</span>
              <button
                type="button"
                className="rounded-full p-0.5 hover:bg-muted"
                onClick={() => Silian_handleRemove(Silian_index)}
                aria-label={Silian_t('admin.products.form.removeTag')}
              >
                <Silian_X className="h-3 w-3" />
              </button>
            </Silian_Badge>
          );
        })}
      </div>
      <div className="mt-3">
        <div className="flex gap-2">
          <Silian_Input
            value={Silian_query}
            onChange={(Silian_event) => Silian_setQuery(Silian_event.target.value)}
            onKeyDown={(Silian_event) => {
              if (Silian_event.key === 'Enter') {
                Silian_event.preventDefault();
                Silian_handleInputAdd();
              }
            }}
            placeholder={Silian_t('admin.products.form.tagPlaceholder')}
          />
          <Silian_Button type="button" variant="outline" onClick={Silian_handleInputAdd} disabled={!Silian_query.trim()}>
            {Silian_t('admin.products.form.addTag')}
          </Silian_Button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{Silian_t('admin.products.form.tagHint')}</p>
      </div>
      <div className="mt-3 rounded-md border border-border bg-muted/40">
        <div className="flex items-center justify-between border-b border-border px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <span>{Silian_t('admin.products.form.suggestions')}</span>
          {Silian_loading ? <Silian_Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-500" /> : null}
        </div>
        <div className="max-h-44 overflow-y-auto">
          {Silian_suggestions.length === 0 && !Silian_loading ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">{Silian_t('admin.products.form.noSuggestions')}</div>
          ) : (
            Silian_suggestions.map((Silian_suggestion, Silian_index) => {
              const Silian_suggestionKey = 'suggestion-' + (Silian_suggestion.id !== undefined && Silian_suggestion.id !== null ? Silian_suggestion.id : Silian_suggestion.slug || Silian_suggestion.name || 'tag') + '-' + Silian_index;
              return (
                <button
                  type="button"
                  key={Silian_suggestionKey}
                  onClick={() => {
                    Silian_addTag(Silian_suggestion);
                    Silian_setQuery('');
                  }}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors hover:bg-background"
                >
                  <span>{Silian_suggestion.name}</span>
                  {Silian_suggestion.slug ? <span className="text-xs uppercase text-muted-foreground">{Silian_suggestion.slug}</span> : null}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export default ProductManagement;

