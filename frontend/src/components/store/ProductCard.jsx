import Silian_React from 'react';
import { ShoppingCart as Silian_ShoppingCart, Star as Silian_Star, Package as Silian_Package, Clock as Silian_Clock } from 'lucide-react';
import { useTranslation as Silian_useTranslation } from '../../hooks/useTranslation';
import { formatNumber as Silian_formatNumber } from '../../lib/utils';
import { Button as Silian_Button } from '../ui/Button';
import { Card as Silian_Card, CardContent as Silian_CardContent, CardDescription as Silian_CardDescription, CardHeader as Silian_CardHeader, CardTitle as Silian_CardTitle } from '../ui/Card';
import Silian_R2Image from '../common/R2Image';
import { Badge as Silian_Badge } from '../ui/badge';

export function ProductCard({ product: Silian_product, onExchange: Silian_onExchange, userPoints: Silian_userPoints = 0 }) {
  const { t: Silian_t } = Silian_useTranslation(['common', 'date', 'images', 'store']);

  const Silian_canAfford = Silian_userPoints >= Silian_product.points_required;
  const Silian_isAvailable = Silian_product.is_available;
  const Silian_isInStock = Silian_product.stock > 0 || Silian_product.stock === -1;

  const Silian_getStockStatus = () => {
    if (Silian_product.stock === -1) return Silian_t('store.unlimited');
    if (Silian_product.stock === 0) return Silian_t('store.outOfStock');
    if (Silian_product.stock <= 5) return Silian_t('store.lowStock', { count: Silian_product.stock });
    return Silian_t('store.inStock', { count: Silian_product.stock });
  };

  const Silian_getStockColor = () => {
    if (Silian_product.stock === -1) return 'text-green-600';
    if (Silian_product.stock === 0) return 'text-red-600';
    if (Silian_product.stock <= 5) return 'text-orange-600';
    return 'text-green-600';
  };

  const Silian_getCategoryIcon = () => {
    const Silian_iconMap = {
      'electronics': '📱',
      'books': '📚',
      'lifestyle': '🎁',
      'food': '🍎',
      'sports': '⚽',
      'travel': '✈️',
      'eco': '🌱',
      'default': '🎁'
    };
    return Silian_iconMap[Silian_product.category] || Silian_iconMap.default;
  };

  const Silian_isHttpUrl = (Silian_value) => typeof Silian_value === 'string' && /^https?:\/\//.test(Silian_value);

  const Silian_resolveImageCandidate = (Silian_candidate) => {
    if (!Silian_candidate) {
      return { src: null, path: null };
    }
    if (typeof Silian_candidate === 'string') {
      return Silian_isHttpUrl(Silian_candidate)
        ? { src: Silian_candidate, path: null }
        : { src: null, path: Silian_candidate };
    }
    if (Array.isArray(Silian_candidate) && Silian_candidate.length) {
      return Silian_resolveImageCandidate(Silian_candidate[0]);
    }
    if (typeof Silian_candidate === 'object') {
      const Silian_rawUrl = typeof Silian_candidate.public_url === 'string' && Silian_candidate.public_url
        ? Silian_candidate.public_url
        : (typeof Silian_candidate.url === 'string' && Silian_candidate.url ? Silian_candidate.url : null);
      const Silian_presigned = typeof Silian_candidate.presigned_url === 'string' && Silian_candidate.presigned_url ? Silian_candidate.presigned_url : null;
      let Silian_src = (Silian_rawUrl && Silian_isHttpUrl(Silian_rawUrl) ? Silian_rawUrl : null) || Silian_presigned;
      let Silian_path = typeof Silian_candidate.file_path === 'string' && Silian_candidate.file_path !== '' ? Silian_candidate.file_path : null;
      if (!Silian_path && Silian_rawUrl && !Silian_isHttpUrl(Silian_rawUrl)) {
        Silian_path = Silian_rawUrl;
      }
      if (!Silian_path && typeof Silian_candidate.path === 'string' && Silian_candidate.path !== '') {
        Silian_path = Silian_candidate.path;
      }
      return { src: Silian_src, path: Silian_path };
    }
    return { src: null, path: null };
  };

  const Silian_primaryImageCandidate = Array.isArray(Silian_product.images) && Silian_product.images.length > 0 ? Silian_product.images[0] : Silian_product.images;
  const Silian_candidateMeta = Silian_resolveImageCandidate(Silian_primaryImageCandidate);
  const Silian_fallbackMeta = Silian_resolveImageCandidate(Silian_product.image_url || Silian_product.image_presigned_url || Silian_product.image_path);
  const Silian_imageSrc = Silian_candidateMeta.src || Silian_fallbackMeta.src;
  const Silian_imagePath = Silian_candidateMeta.path || Silian_fallbackMeta.path;
  const Silian_hasImage = Boolean(Silian_imageSrc || Silian_imagePath);

  return (
    <Silian_Card className={`h-full ${!Silian_isAvailable || !Silian_canAfford ? 'opacity-75' : ''}`}>
      <Silian_CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-2xl">{Silian_getCategoryIcon()}</span>
            <div>
              <Silian_CardTitle className="text-lg line-clamp-2">{Silian_product.name}</Silian_CardTitle>
              <Silian_CardDescription className="text-sm text-muted-foreground">
                {Silian_t(`store.categories.${Silian_product.category}`, Silian_product.category)}
              </Silian_CardDescription>
            </div>
          </div>
          {Silian_product.is_featured && (
            <div className="flex items-center space-x-1 rounded-full bg-yellow-500/15 px-2 py-1 text-xs text-yellow-500">
              <Silian_Star className="h-3 w-3 fill-current" />
              <span>{Silian_t('store.featured')}</span>
            </div>
          )}
        </div>
      </Silian_CardHeader>

      <Silian_CardContent className="space-y-4">
        {/* Product image */}
        {Silian_hasImage && (
          <div className="aspect-video overflow-hidden rounded-lg bg-muted">
            <Silian_R2Image
              src={Silian_imageSrc || undefined}
              filePath={Silian_imagePath || undefined}
              alt={Silian_product.name}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <p className="line-clamp-3 text-sm text-muted-foreground">{Silian_product.description}</p>

        {Array.isArray(Silian_product.tags) && Silian_product.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {Silian_product.tags.map((Silian_tag, Silian_index) => (
              <Silian_Badge key={`product-tag-${Silian_product.id}-${Silian_tag.id ?? Silian_tag.slug ?? Silian_index}`} variant="secondary" className="text-xs uppercase">
                {Silian_tag.name}
              </Silian_Badge>
            ))}
          </div>
        )}
        {/* 积分和库存信息 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-2xl font-bold text-green-600">
                {Silian_formatNumber(Silian_product.points_required)}
              </span>
              <span className="text-sm text-muted-foreground">{Silian_t('common.points')}</span>
            </div>
            <div className={`flex items-center space-x-1 text-sm ${Silian_getStockColor()}`}>
              <Silian_Package className="h-4 w-4" />
              <span>{Silian_getStockStatus()}</span>
            </div>
          </div>

          {/* 兑换统计 */}
          {Silian_product.total_exchanged > 0 && (
            <div className="flex items-center space-x-1 text-xs text-muted-foreground">
              <Silian_Clock className="h-3 w-3" />
              <span>{Silian_t('store.exchangedCount', { count: Silian_product.total_exchanged })}</span>
            </div>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="pt-2">
          {!Silian_isAvailable ? (
            <Silian_Button disabled className="w-full">
              {Silian_t('store.unavailable')}
            </Silian_Button>
          ) : !Silian_isInStock ? (
            <Silian_Button disabled className="w-full">
              {Silian_t('store.outOfStock')}
            </Silian_Button>
          ) : !Silian_canAfford ? (
            <Silian_Button disabled className="w-full">
              <span className="flex items-center justify-center space-x-2">
                <span>{Silian_t('store.insufficientPoints')}</span>
                <span className="text-xs">
                  ({Silian_t('store.need')} {Silian_formatNumber(Silian_product.points_required - Silian_userPoints)})
                </span>
              </span>
            </Silian_Button>
          ) : (
            <Silian_Button
              onClick={() => Silian_onExchange(Silian_product)}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              <Silian_ShoppingCart className="h-4 w-4 mr-2" />
              {Silian_t('store.exchange.button')}
            </Silian_Button>
          )}
        </div>

        {/* 用户积分提示 */}
        {Silian_canAfford && Silian_isAvailable && Silian_isInStock && (
          <div className="text-center text-xs text-muted-foreground">
            {Silian_t('store.afterExchange')}: {Silian_formatNumber(Silian_userPoints - Silian_product.points_required)} {Silian_t('common.points')}
          </div>
        )}
      </Silian_CardContent>
    </Silian_Card>
  );
}
