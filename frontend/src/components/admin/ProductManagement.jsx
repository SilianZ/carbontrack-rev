import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { Loader2, Edit, Trash2, PlusCircle, Search, Image as ImageIcon, X } from 'lucide-react';
import { toast } from 'react-hot-toast';

import { useTranslation } from '@/hooks/useTranslation';
import { adminAPI, productAPI } from '@/lib/api';
import { formatNumber } from '@/lib/utils';
import { uploadViaPresign } from '@/lib/r2Upload';
import { prefetchPresignedUrls, getPresignedReadUrl } from '@/lib/fileAccess';

import R2Image from '@/components/common/R2Image';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Pagination } from '@/components/ui/Pagination';

const DEFAULT_FORM = {
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

const STATUS_OPTIONS = [
  { value: 'active', labelKey: 'admin.products.statusActive' },
  { value: 'inactive', labelKey: 'admin.products.statusInactive' },
];

const sanitizeNumber = (value, fallback = 0) => {
  if (value === null || value === undefined || value === '') return fallback;
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const slugify = (input) => {
  if (!input) return '';
  return input
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
};

const randomSlug = () => 'tag-' + Math.random().toString(36).slice(2, 8);

const normalizeCategory = (category) => {
  if (!category) {
    return null;
  }

  if (typeof category === 'string') {
    const name = category.trim();
    if (!name) {
      return null;
    }
    const slug = name.trim().toLowerCase();
    return {
      id: null,
      name,
      slug: slug || name,
    };
  }

  if (typeof category === 'object') {
    const idRaw =
      category.id ??
      category.category_id ??
      category.value ??
      category.key ??
      null;
    const id =
      idRaw !== null &&
      idRaw !== undefined &&
      idRaw !== '' &&
      !Number.isNaN(Number(idRaw))
        ? Number(idRaw)
        : null;

    const nameRaw =
      category.name ??
      category.category ??
      category.label ??
      category.value ??
      '';
    const name =
      typeof nameRaw === 'string' ? nameRaw.trim() : String(nameRaw || '').trim();

    const slugRaw =
      category.slug ??
      category.category_slug ??
      category.value ??
      '';
    let slug =
      typeof slugRaw === 'string' ? slugRaw.trim() : String(slugRaw || '').trim();
    if (!slug && name) {
      slug = name.trim();
    }
    if (slug) {
      slug = slug.toLowerCase();
    }
    if (!slug) {
      slug = randomSlug();
    }

    const fallbackSlug =
      typeof slugRaw === 'string' ? slugRaw.trim() : String(slugRaw || '').trim();
    const finalName = name || fallbackSlug || slug;

    if (!finalName) {
      return null;
    }

    return {
      id,
      name: finalName,
      slug,
    };
  }

  return null;
};

const mapCategorySuggestions = (items) => {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      const normalized = normalizeCategory(item);
      if (!normalized) return null;
      return {
        ...normalized,
        product_count: item?.product_count ?? item?.count ?? item?.total ?? 0,
      };
    })
    .filter(Boolean);
};

const normalizeTag = (tag) => {
  if (!tag) {
    return null;
  }
  if (typeof tag === 'string') {
    const name = tag.trim();
    if (!name) return null;
    return {
      id: null,
      name,
      slug: slugify(name) || randomSlug(),
    };
  }
  const name = tag.name?.trim() || tag.label?.trim() || tag.value?.trim() || '';
  if (!name) {
    return null;
  }
  const id = tag.id !== undefined && tag.id !== null && tag.id !== '' ? Number(tag.id) : null;
  const slug = slugify(tag.slug || name) || randomSlug();
  return { id, name, slug };
};

const buildProductPayload = (form) => {
  const cleanName = (form.name || '').trim();
  const normalizedCategory = normalizeCategory(form.category);
  const normalizedTags = (form.tags || [])
    .map((item) => normalizeTag(item))
    .filter(Boolean)
    .reduce((acc, tag) => {
      const exists = acc.find((current) => {
        if (current.id && tag.id) {
          return current.id === tag.id;
        }
        return current.slug === tag.slug;
      });
      if (!exists) {
        acc.push(tag);
      }
      return acc;
    }, []);

  const imagesArray = Array.isArray(form.images) ? form.images.filter(Boolean) : [];

  return {
    name: cleanName,
    description: form.description || '',
    category: normalizedCategory
      ? { id: normalizedCategory.id, name: normalizedCategory.name, slug: normalizedCategory.slug }
      : null,
    points_required: sanitizeNumber(form.points_required),
    stock: sanitizeNumber(form.stock, -1),
    status: form.status || 'active',
    sort_order: sanitizeNumber(form.sort_order, 0),
    image_path: form.image_path || undefined,
    image_url: form.image_url || undefined,
    images: imagesArray.length ? imagesArray : undefined,
    tags: normalizedTags,
  };
};
export function ProductManagement() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [filters, setFilters] = useState({
    search: '',
    category: '',
    status: '',
    page: 1,
    limit: 10,
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, product: null });

  const productsQuery = useQuery(
    ['adminProducts', filters],
    () => adminAPI.getProducts(filters).then((res) => res.data),
    { keepPreviousData: true }
  );

  const categoriesQuery = useQuery('productCategories', () => productAPI.getCategories().then((res) => res.data));

  const createProduct = useMutation((payload) => adminAPI.createProduct(payload));
  const updateProduct = useMutation(({ id, payload }) => adminAPI.updateProduct(id, payload));
  const deleteProductMutation = useMutation((id) => adminAPI.deleteProduct(id));

  const isSubmitting = createProduct.isLoading || updateProduct.isLoading;

  const productsContainer = productsQuery.data?.data || productsQuery.data || {};
  const productsRaw = productsContainer.products || productsContainer.data || productsQuery.data || [];
  const products = useMemo(() => (Array.isArray(productsRaw) ? productsRaw : []), [productsRaw]);
  const pagination = productsContainer.pagination || {
    page: filters.page,
    limit: filters.limit,
    total: products.length,
    pages: 1,
    current_page: filters.page,
    per_page: filters.limit,
    total_items: products.length,
    total_pages: 1,
  };

  const categories = useMemo(() => {
    const dataPayload = categoriesQuery.data?.data;
    const source = Array.isArray(dataPayload?.categories)
      ? dataPayload.categories
      : Array.isArray(dataPayload)
        ? dataPayload
        : categoriesQuery.data?.categories || [];
    if (!Array.isArray(source)) return [];
    return mapCategorySuggestions(source);
  }, [categoriesQuery.data]);

  useEffect(() => {
    const paths = products
      .map((product) => {
        const images = Array.isArray(product.images) ? product.images : [];
        const firstImage = images.length > 0 ? images[0] : null;

        const firstImagePath = (() => {
          if (!firstImage) return null;
          if (typeof firstImage === 'string') {
            return firstImage.indexOf('http') === 0 ? null : firstImage;
          }
          if (typeof firstImage === 'object' && firstImage !== null) {
            if (firstImage.file_path) {
              return firstImage.file_path;
            }
            if (typeof firstImage.url === 'string' && firstImage.url.indexOf('http') !== 0) {
              return firstImage.url;
            }
          }
          return null;
        })();

        const candidateFilePath = product.image_path
          || firstImagePath
          || (typeof product.image_url === 'string' && product.image_url.indexOf('http') !== 0 ? product.image_url : null);

        const hasInlineUrl =
          (typeof product.image_url === 'string' && product.image_url.indexOf('http') === 0 && product.image_url) ||
          (typeof product.image_presigned_url === 'string' && product.image_presigned_url) ||
          (firstImage && typeof firstImage === 'string' && firstImage.indexOf('http') === 0 && firstImage) ||
          (firstImage && typeof firstImage === 'object' && firstImage !== null && typeof firstImage.url === 'string' && firstImage.url.indexOf('http') === 0 && firstImage.url) ||
          (firstImage && typeof firstImage === 'object' && firstImage !== null && typeof firstImage.presigned_url === 'string' && firstImage.presigned_url);

        if (!candidateFilePath || hasInlineUrl) {
          return null;
        }

        return candidateFilePath;
      })
      .filter(Boolean);

    if (paths.length) {
      prefetchPresignedUrls(paths).catch(() => {});
    }
  }, [products]);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  const handlePageChange = (page) => {
    setFilters((prev) => ({ ...prev, page }));
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
  };

  const openCreateModal = () => {
    setEditingProduct(null);
    setIsModalOpen(true);
  };

  const openEditModal = (product) => {
    setEditingProduct(product);
    setIsModalOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (!deleteDialog.product) return;
    deleteProductMutation.mutate(deleteDialog.product.id, {
      onSuccess: () => {
        toast.success(t('admin.products.deleteSuccess'));
        queryClient.invalidateQueries('adminProducts');
      },
      onError: () => {
        toast.error(t('admin.products.deleteFailed'));
      },
      onSettled: () => setDeleteDialog({ open: false, product: null }),
    });
  };

  const handleSubmit = useCallback(
    (formValues) => {
      const payload = buildProductPayload(formValues);
      if (editingProduct) {
        updateProduct.mutate(
          { id: editingProduct.id, payload },
          {
            onSuccess: () => {
              toast.success(t('admin.products.updateSuccess'));
              queryClient.invalidateQueries('adminProducts');
              handleCloseModal();
            },
            onError: () => {
              toast.error(t('admin.products.updateFailed'));
            },
          }
        );
        return;
      }

      createProduct.mutate(payload, {
        onSuccess: () => {
          toast.success(t('admin.products.createSuccess'));
          queryClient.invalidateQueries('adminProducts');
          handleCloseModal();
        },
        onError: () => {
          toast.error(t('admin.products.createFailed'));
        },
      });
    },
    [createProduct, editingProduct, queryClient, t, updateProduct]
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t('admin.products.title')}</h2>
        <p className="text-muted-foreground">{t('admin.products.description')}</p>
      </div>

      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">{t('common.search')}</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  value={filters.search}
                  onChange={(event) => handleFilterChange('search', event.target.value)}
                  placeholder={t('admin.products.searchPlaceholder')}
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">{t('admin.products.category')}</label>
              <select
                value={filters.category}
                onChange={(event) => handleFilterChange('category', event.target.value)}
                className="mt-0 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-emerald-500 focus:outline-none focus:ring-emerald-500"
              >
                <option value="">{t('common.all')}</option>
                {categories.map((category) => (
                  <option
                    key={category.slug || category.id || category.name}
                    value={category.slug || category.id || category.name}
                  >
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">{t('admin.products.status')}</label>
              <select
                value={filters.status}
                onChange={(event) => handleFilterChange('status', event.target.value)}
                className="mt-0 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-emerald-500 focus:outline-none focus:ring-emerald-500"
              >
                <option value="">{t('common.all')}</option>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(option.labelKey)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <Button onClick={openCreateModal} className="shrink-0">
            <PlusCircle className="mr-2 h-4 w-4" />
            {t('admin.products.addProduct')}
          </Button>
        </div>
      </div>
      {productsQuery.isLoading || productsQuery.isFetching ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        </div>
      ) : productsQuery.error ? (
        <Alert variant="destructive">
          <AlertTitle>{t('common.error')}</AlertTitle>
          <AlertDescription>{t('errors.loadFailed')}</AlertDescription>
        </Alert>
      ) : products.length === 0 ? (
        <div className="rounded-lg border bg-white p-16 text-center shadow-sm">
          <h3 className="text-xl font-semibold">{t('admin.products.noProductsFound')}</h3>
          <p className="mt-2 text-muted-foreground">{t('admin.products.tryDifferentFilters')}</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    {t('admin.products.table.image')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    {t('admin.products.table.name')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    {t('admin.products.table.category')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    {t('admin.products.table.price')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    {t('admin.products.table.stock')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    {t('admin.products.table.tags')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    {t('admin.products.table.status')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    {t('admin.products.table.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {products.map((product) => {
                  const price = product.points_required !== undefined && product.points_required !== null ? product.points_required : product.price || 0;
                  const isOutOfStock = product.stock === 0;
                  const unlimited = product.stock === -1;
                  const images = Array.isArray(product.images) ? product.images : [];
                  const firstImage = images.length > 0 ? images[0] : null;

                  const firstImagePath = (() => {
                    if (!firstImage) return null;
                    if (typeof firstImage === 'string') {
                      return firstImage.indexOf('http') === 0 ? null : firstImage;
                    }
                    if (typeof firstImage === 'object' && firstImage !== null) {
                      if (firstImage.file_path) {
                        return firstImage.file_path;
                      }
                      if (typeof firstImage.url === 'string' && firstImage.url.indexOf('http') !== 0) {
                        return firstImage.url;
                      }
                    }
                    return null;
                  })();

                  const candidateFilePath = product.image_path
                    || firstImagePath
                    || (typeof product.image_url === 'string' && product.image_url.indexOf('http') !== 0 ? product.image_url : null);

                  const presignedFromProduct = typeof product.image_presigned_url === 'string' && product.image_presigned_url ? product.image_presigned_url : null;
                  const presignedFromImage = firstImage && typeof firstImage === 'object' && firstImage !== null && typeof firstImage.presigned_url === 'string' && firstImage.presigned_url
                    ? firstImage.presigned_url
                    : null;

                  const httpImageCandidates = [
                    typeof product.image_url === 'string' && product.image_url.indexOf('http') === 0 ? product.image_url : null,
                    firstImage && typeof firstImage === 'string' && firstImage.indexOf('http') === 0 ? firstImage : null,
                    firstImage && typeof firstImage === 'object' && firstImage !== null && typeof firstImage.url === 'string' && firstImage.url.indexOf('http') === 0 ? firstImage.url : null,
                    presignedFromProduct,
                    presignedFromImage,
                  ];

                  const resolvedImageSrc = httpImageCandidates.find((value) => typeof value === 'string' && value) || null;
                  const imageFilePath = candidateFilePath || null;

                  return (
                    <tr key={product.id}>
                      <td className="px-6 py-4">
                        {imageFilePath || resolvedImageSrc ? (
                          <R2Image
                            filePath={imageFilePath || undefined}
                            src={resolvedImageSrc || undefined}
                            alt={product.name}
                            className="h-12 w-12 rounded-lg object-cover"
                            fallback={<div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100 text-xs text-gray-400">IMG</div>}
                          />
                        ) : (
                          <ImageIcon className="h-10 w-10 text-gray-300" />
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{product.name}</div>
                        <div className="text-sm text-gray-500">{product.description}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{product.category || t('admin.products.form.uncategorized')}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-green-600">
                        {formatNumber(price, 0)} {t('common.points')}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {unlimited ? t('admin.products.unlimited') : formatNumber(product.stock, 0)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        <div className="flex flex-wrap gap-1">
                          {(product.tags || []).map((tag) => {
                            const keyValue = String(product.id || 'product') + '-' + String(tag.id !== undefined && tag.id !== null ? tag.id : tag.slug || tag.name || 'tag');
                            return (
                              <Badge key={keyValue} variant="secondary" className="uppercase">
                                {tag.name}
                              </Badge>
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {isOutOfStock ? (
                          <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                            {t('admin.products.statusOutOfStock')}
                          </span>
                        ) : product.status === 'active' ? (
                          <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                            {t('admin.products.statusActive')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
                            {t('admin.products.statusInactive')}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-medium">
                        <Button variant="ghost" size="sm" onClick={() => openEditModal(product)} className="mr-2">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteDialog({ open: true, product })}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={pagination.current_page || pagination.page}
            totalPages={pagination.total_pages || pagination.pages || 1}
            onPageChange={handlePageChange}
            itemsPerPage={pagination.per_page || pagination.limit}
            totalItems={pagination.total_items || pagination.total}
          />
        </>
      )}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => (!open ? setDeleteDialog({ open: false, product: null }) : null)}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.products.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.products.confirmDelete', {
                name: deleteDialog.product?.name || t('admin.products.unnamed'),
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteDialog({ open: false, product: null })}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700 focus-visible:ring-red-600"
              disabled={deleteProductMutation.isLoading}
            >
              {deleteProductMutation.isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              {t('common.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isModalOpen && (
        <ProductFormModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onSubmit={handleSubmit}
          product={editingProduct}
          categories={categories}
          isSubmitting={isSubmitting}
          t={t}
        />
      )}
    </div>
  );
}

function ProductFormModal({ isOpen, onClose, onSubmit, product, categories, isSubmitting, t }) {
  const [formValues, setFormValues] = useState(DEFAULT_FORM);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      setFormValues(DEFAULT_FORM);
      return;
    }

    if (product) {
      const firstImage = Array.isArray(product.images) && product.images.length ? product.images[0] : null;
      setFormValues({
        name: product.name || '',
        description: product.description || '',
        category: normalizeCategory({
          id: product.category_id ?? product.categoryId ?? null,
          name: product.category ?? '',
          slug: product.category_slug ?? product.categorySlug ?? '',
        }),
        points_required: product.points_required !== undefined && product.points_required !== null ? product.points_required : product.price || 0,
        stock: product.stock !== undefined && product.stock !== null ? product.stock : -1,
        status: product.status || 'active',
        sort_order: product.sort_order !== undefined && product.sort_order !== null ? product.sort_order : 0,
        image_path: product.image_path || (typeof product.image_url === 'string' && product.image_url.indexOf('http') !== 0 ? product.image_url : '') || firstImage?.file_path || '',
        image_url: typeof product.image_url === 'string' ? product.image_url : (firstImage?.url || ''),
        image_presigned_url: product.image_presigned_url || firstImage?.presigned_url || '',
        images: Array.isArray(product.images) ? product.images : [],
        tags: Array.isArray(product.tags)
          ? product.tags.map((tag) => ({ id: tag.id !== undefined ? tag.id : null, name: tag.name, slug: tag.slug || slugify(tag.name) }))
          : [],
      });
    } else {
      setFormValues(DEFAULT_FORM);
    }
  }, [isOpen, product]);

  const handleChange = (field) => (event) => {
    setFormValues((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleTagChange = (nextTags) => {
    setFormValues((prev) => ({ ...prev, tags: nextTags }));
  };

  const handleCategoryChange = (nextCategory) => {
    setFormValues((prev) => ({ ...prev, category: normalizeCategory(nextCategory) }));
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('admin.products.form.fileTooLarge', '图片大小不能超过 5MB'));
      event.target.value = '';
      return;
    }

    setUploading(true);
    try {
      const result = await uploadViaPresign(file, {
        directory: 'products',
        entityType: 'product',
        entityId: product ? product.id : undefined,
      });

      let previewUrl = result.url || result.public_url || result.presigned_url || '';
      if (!previewUrl && result.file_path) {
        try {
          previewUrl = await getPresignedReadUrl(result.file_path, 600);
        } catch (error) {
          console.warn('Preview presign failed', error);
        }
      }

      const storedUrl = result.public_url || result.url || '';
      const imageData = {
        file_path: result.file_path,
        url: storedUrl,
        presigned_url: result.presigned_url || (previewUrl || null),
        thumbnail_path: result.thumbnail_path || null,
      };

      setFormValues((prev) => ({
        ...prev,
        image_path: result.file_path || prev.image_path,
        image_url: storedUrl,
        image_presigned_url: imageData.presigned_url || '',
        images: [imageData],
      }));
      toast.success(t('admin.products.form.uploadSuccess', '图片上传成功'));
    } catch (error) {
      toast.error(t('admin.products.form.uploadFailed', '图片上传失败，请重试'));
    } finally {
      setUploading(false);
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const handleRemoveImage = () => {
    setFormValues((prev) => ({ ...prev, image_path: '', image_url: '', image_presigned_url: '', images: [] }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const trimmedName = (formValues.name || '').trim();
    if (!trimmedName) {
      toast.error(t('validation.required'));
      return;
    }
    const nextValues = trimmedName === formValues.name ? formValues : { ...formValues, name: trimmedName };
    onSubmit(nextValues);
  };

  const previewSource = formValues.image_url || formValues.image_presigned_url || '';
  const imagePath = formValues.image_path || (previewSource && previewSource.indexOf('http') !== 0 ? previewSource : '');
  const externalImage = !imagePath && previewSource && previewSource.indexOf('http') === 0 ? previewSource : '';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (!open ? onClose() : null)}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? t('admin.products.editProduct') : t('admin.products.addProduct')}</DialogTitle>
          <DialogDescription>{t('admin.products.formModal.description')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label htmlFor="product-name" className="block text-sm font-medium text-gray-700">
                {t('admin.products.form.name')}
              </label>
              <Input
                id="product-name"
                value={formValues.name}
                onChange={handleChange('name')}
                required
              />
            </div>
            <div>
              <ProductCategorySelector
                value={formValues.category}
                onChange={handleCategoryChange}
                initialCategories={categories}
                t={t}
              />
            </div>
            <div>
              <label htmlFor="product-status" className="block text-sm font-medium text-gray-700">
                {t('admin.products.form.status')}
              </label>
              <select
                id="product-status"
                value={formValues.status}
                onChange={handleChange('status')}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-emerald-500 focus:outline-none focus:ring-emerald-500"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(option.labelKey)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="product-points" className="block text-sm font-medium text-gray-700">
                {t('admin.products.form.pointsRequired')}
              </label>
              <Input
                id="product-points"
                type="number"
                min={0}
                value={formValues.points_required}
                onChange={handleChange('points_required')}
                required
              />
            </div>
            <div>
              <label htmlFor="product-stock" className="block text-sm font-medium text-gray-700">
                {t('admin.products.form.stock')}
              </label>
              <Input
                id="product-stock"
                type="number"
                value={formValues.stock}
                onChange={handleChange('stock')}
              />
              <p className="mt-1 text-xs text-gray-500">{t('admin.products.form.stockHint')}</p>
            </div>
            <div>
              <label htmlFor="product-sort-order" className="block text-sm font-medium text-gray-700">
                {t('admin.products.form.sortOrder')}
              </label>
              <Input
                id="product-sort-order"
                type="number"
                value={formValues.sort_order}
                onChange={handleChange('sort_order')}
              />
            </div>
          </div>

          <div>
            <label htmlFor="product-description" className="block text-sm font-medium text-gray-700">
              {t('admin.products.form.description')}
            </label>
            <Textarea
              id="product-description"
              value={formValues.description}
              onChange={handleChange('description')}
              className="min-h-[120px]"
            />
          </div>

          <div>
            <ProductTagSelector value={formValues.tags} onChange={handleTagChange} t={t} />
          </div>

          <div>
            <span className="block text-sm font-medium text-gray-700">{t('admin.products.form.image')}</span>
            <div className="mt-2 flex items-center gap-4">
              {imagePath || externalImage ? (
                <R2Image
                  filePath={imagePath || undefined}
                  src={externalImage || undefined}
                  alt={formValues.name || 'product'}
                  className="h-20 w-20 rounded-lg object-cover"
                  fallback={<div className="flex h-20 w-20 items-center justify-center rounded-lg bg-gray-100 text-xs text-gray-400">IMG</div>}
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 text-gray-400">
                  <ImageIcon className="h-6 w-6" />
                </div>
              )}
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current && fileInputRef.current.click()}
                    disabled={uploading || isSubmitting}
                  >
                    {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                    {uploading ? t('admin.products.form.uploading') : t('admin.products.form.chooseImage')}
                  </Button>
                  {(imagePath || externalImage) && (
                    <Button type="button" variant="ghost" onClick={handleRemoveImage} disabled={isSubmitting}>
                      <X className="mr-2 h-4 w-4" />
                      {t('admin.products.form.removeImage')}
                    </Button>
                  )}
                </div>
                <p className="text-xs text-gray-500">{t('admin.products.form.imageHint')}</p>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting || uploading}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting || uploading}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isSubmitting ? t('common.saving') : t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
function ProductCategorySelector({ value, onChange, initialCategories = [], t }) {
  const [query, setQuery] = useState('');
  const inputId = useMemo(() => 'product-category-input-' + Math.random().toString(36).slice(2, 8), []);
  const [suggestions, setSuggestions] = useState(() => mapCategorySuggestions(initialCategories));
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);

  const normalizedValue = normalizeCategory(value);

  useEffect(() => {
    const incoming = mapCategorySuggestions(initialCategories);
    if (!incoming.length) {
      return;
    }
    setSuggestions((prev) => {
      const map = new Map();
      incoming.forEach((item) => {
        const key = (item.slug || item.name || '').toLowerCase();
        if (key) {
          map.set(key, item);
        }
      });
      prev.forEach((item) => {
        if (!item) return;
        const key = (item.slug || item.name || '').toLowerCase();
        if (key && !map.has(key)) {
          map.set(key, item);
        }
      });
      return Array.from(map.values());
    });
  }, [initialCategories]);

  const loadSuggestions = useCallback(async (term) => {
    setLoading(true);
    try {
      const response = await productAPI.getCategories({ search: term || '', limit: 12 });
      const payload = response.data?.data;
      const items = Array.isArray(payload?.categories)
        ? payload.categories
        : Array.isArray(payload)
          ? payload
          : response.data?.categories || [];
      setSuggestions(mapCategorySuggestions(items));
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Category search failed', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSuggestions('');
  }, [loadSuggestions]);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      loadSuggestions(query.trim());
    }, 250);
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, loadSuggestions]);

  const handleSelect = useCallback((category) => {
    const normalized = normalizeCategory(category);
    if (!normalized) return;
    if (typeof onChange === 'function') {
      onChange(normalized);
    }
    setQuery('');
  }, [onChange]);

  const handleCreate = useCallback(() => {
    const trimmed = query.trim();
    if (!trimmed) return;
    handleSelect({ name: trimmed });
  }, [query, handleSelect]);

  const handleClear = useCallback(() => {
    if (typeof onChange === 'function') {
      onChange(null);
    }
  }, [onChange]);

  return (
    <div>
      <label htmlFor={inputId} className="block text-sm font-medium text-gray-700">{t('admin.products.form.category')}</label>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {normalizedValue ? (
          <Badge variant="secondary" className="flex items-center gap-1">
            <span>{normalizedValue.name}</span>
            <button
              type="button"
              className="rounded-full p-0.5 hover:bg-gray-200"
              onClick={handleClear}
              aria-label={t('admin.products.form.removeCategory', '移除分类')}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ) : (
          <span className="text-xs text-gray-500">{t('admin.products.form.categoryPlaceholder')}</span>
        )}
      </div>
      <div className="mt-3 flex gap-2">
        <Input
          id={inputId}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              handleCreate();
            }
          }}
          placeholder={t('admin.products.form.categorySearchPlaceholder', '输入或搜索分类名称')}
        />
        <Button type="button" variant="outline" onClick={handleCreate} disabled={!query.trim()}>
          {t('admin.products.form.useCategory', '使用分类')}
        </Button>
      </div>
      <p className="mt-1 text-xs text-gray-500">
        {t('admin.products.form.categoryHint', '可选择已有分类或输入新分类，新分类会自动保存。')}
      </p>
      <div className="mt-3 rounded-md border bg-gray-50">
        <div className="flex items-center justify-between border-b px-3 py-2 text-xs font-medium uppercase tracking-wide text-gray-500">
          <span>{t('admin.products.form.suggestions')}</span>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-500" /> : null}
        </div>
        <div className="max-h-44 overflow-y-auto">
          {suggestions.length === 0 && !loading ? (
            <div className="px-3 py-2 text-sm text-gray-500">
              {t('admin.products.form.noCategorySuggestions', '暂无匹配的分类，按回车创建新的分类。')}
            </div>
          ) : (
            suggestions.map((item) => {
              const key = `category-suggestion-${item.slug || item.id || item.name}`;
              const isActive =
                normalizedValue &&
                (normalizedValue.slug === item.slug || normalizedValue.name === item.name);
              return (
                <button
                  type="button"
                  key={key}
                  onClick={() => handleSelect(item)}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-white ${isActive ? 'bg-white' : ''}`}
                >
                  <span>{item.name}</span>
                  <span className="text-xs uppercase text-gray-400">
                    {item.product_count !== undefined && item.product_count !== null ? item.product_count : item.slug}
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

function ProductTagSelector({ value, onChange, t }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);

  const loadSuggestions = useCallback(async (term) => {
    setLoading(true);
    try {
      const response = await adminAPI.searchProductTags({ search: term || '', limit: 12 });
      setSuggestions(response.data?.data?.tags || []);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Tag search failed', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSuggestions('');
  }, [loadSuggestions]);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      loadSuggestions(query.trim());
    }, 250);
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, loadSuggestions]);

  const addTag = (tag) => {
    const normalized = normalizeTag(tag);
    if (!normalized) return;
    const exists = (value || []).some((item) => {
      if (item.id && normalized.id) {
        return item.id === normalized.id;
      }
      return item.slug === normalized.slug;
    });
    if (!exists) {
      onChange([].concat(value || [], [normalized]));
    }
  };

  const handleInputAdd = () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    const match = suggestions.find((item) => (item.name || '').toLowerCase() === trimmed.toLowerCase());
    addTag(match || trimmed);
    setQuery('');
  };

  const handleRemove = (index) => {
    const next = (value || []).slice();
    next.splice(index, 1);
    onChange(next);
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">{t('admin.products.form.tags')}</label>
      <div className="mt-2 flex flex-wrap gap-2">
        {(value || []).map((tag, index) => {
          const keyValue = 'selected-tag-' + index + '-' + (tag.id !== undefined && tag.id !== null ? tag.id : tag.slug || tag.name || 'tag');
          return (
            <Badge key={keyValue} variant="secondary" className="flex items-center gap-1 uppercase">
              <span>{tag.name}</span>
              <button
                type="button"
                className="rounded-full p-0.5 hover:bg-gray-200"
                onClick={() => handleRemove(index)}
                aria-label={t('admin.products.form.removeTag', '移除标签')}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          );
        })}
      </div>
      <div className="mt-3">
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleInputAdd();
              }
            }}
            placeholder={t('admin.products.form.tagPlaceholder')}
          />
          <Button type="button" variant="outline" onClick={handleInputAdd} disabled={!query.trim()}>
            {t('admin.products.form.addTag')}
          </Button>
        </div>
        <p className="mt-1 text-xs text-gray-500">{t('admin.products.form.tagHint')}</p>
      </div>
      <div className="mt-3 rounded-md border bg-gray-50">
        <div className="flex items-center justify-between border-b px-3 py-2 text-xs font-medium uppercase tracking-wide text-gray-500">
          <span>{t('admin.products.form.suggestions')}</span>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-500" /> : null}
        </div>
        <div className="max-h-44 overflow-y-auto">
          {suggestions.length === 0 && !loading ? (
            <div className="px-3 py-2 text-sm text-gray-500">{t('admin.products.form.noSuggestions')}</div>
          ) : (
            suggestions.map((suggestion, index) => {
              const suggestionKey = 'suggestion-' + (suggestion.id !== undefined && suggestion.id !== null ? suggestion.id : suggestion.slug || suggestion.name || 'tag') + '-' + index;
              return (
                <button
                  type="button"
                  key={suggestionKey}
                  onClick={() => {
                    addTag(suggestion);
                    setQuery('');
                  }}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-white"
                >
                  <span>{suggestion.name}</span>
                  {suggestion.slug ? <span className="text-xs uppercase text-gray-400">{suggestion.slug}</span> : null}
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

