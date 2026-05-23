import Silian_React, { useState as Silian_useState, useEffect as Silian_useEffect } from 'react';
import { X as Silian_X, ShoppingCart as Silian_ShoppingCart, Package as Silian_Package, MapPin as Silian_MapPin, Phone as Silian_Phone, MessageSquare as Silian_MessageSquare } from 'lucide-react';
import { useTranslation as Silian_useTranslation } from '../../hooks/useTranslation';
import { formatNumber as Silian_formatNumber } from '../../lib/utils';
import { Button as Silian_Button } from '../ui/Button';
import { Input as Silian_Input } from '../ui/Input';
import { Card as Silian_Card, CardContent as Silian_CardContent, CardDescription as Silian_CardDescription, CardHeader as Silian_CardHeader, CardTitle as Silian_CardTitle } from '../ui/Card';
import Silian_R2Image from '../common/R2Image';

export function ExchangeModal({ product: Silian_product, userPoints: Silian_userPoints, userEmail: Silian_userEmail, isOpen: Silian_isOpen, onClose: Silian_onClose, onConfirm: Silian_onConfirm, isLoading: Silian_isLoading }) {
  const { t: Silian_t } = Silian_useTranslation(['common', 'date', 'errors', 'images', 'store']);
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

  const [Silian_quantity, Silian_setQuantity] = Silian_useState(1);
  const [Silian_deliveryAddress, Silian_setDeliveryAddress] = Silian_useState('');
  const [Silian_contactAreaCode, Silian_setContactAreaCode] = Silian_useState('');
  const [Silian_contactPhone, Silian_setContactPhone] = Silian_useState('');
  const [Silian_notes, Silian_setNotes] = Silian_useState('');
  const [Silian_errors, Silian_setErrors] = Silian_useState({});

  Silian_useEffect(() => {
    if (!Silian_isOpen) {
      return;
    }

    Silian_setQuantity(1);
    Silian_setDeliveryAddress(Silian_userEmail || '');
    Silian_setContactAreaCode('');
    Silian_setContactPhone('');
    Silian_setNotes('');
    Silian_setErrors({});
  }, [Silian_isOpen, Silian_product?.id, Silian_userEmail]);

  if (!Silian_isOpen || !Silian_product) return null;

  const Silian_primaryImageCandidate = Array.isArray(Silian_product.images) && Silian_product.images.length > 0 ? Silian_product.images[0] : Silian_product.images;
  const Silian_candidateMeta = Silian_resolveImageCandidate(Silian_primaryImageCandidate);
  const Silian_fallbackMeta = Silian_resolveImageCandidate(Silian_product.image_url || Silian_product.image_presigned_url || Silian_product.image_path);
  const Silian_imageSrc = Silian_candidateMeta.src || Silian_fallbackMeta.src;
  const Silian_imagePath = Silian_candidateMeta.path || Silian_fallbackMeta.path;
  const Silian_hasImage = Boolean(Silian_imageSrc || Silian_imagePath);

  const Silian_totalPoints = Silian_product.points_required * Silian_quantity;
  const Silian_canAfford = Silian_userPoints >= Silian_totalPoints;
  const Silian_maxQuantity = Silian_product.stock === -1 ? 10 : Math.min(Silian_product.stock, Math.floor(Silian_userPoints / Silian_product.points_required));

  const Silian_validateForm = () => {
    const Silian_newErrors = {};

    if (Silian_quantity < 1 || Silian_quantity > Silian_maxQuantity) {
      Silian_newErrors.quantity = Silian_t('store.exchange.invalidQuantity');
    }

    const Silian_trimmedAddress = Silian_deliveryAddress.trim();
    const Silian_trimmedAreaCode = Silian_contactAreaCode.trim();
    const Silian_trimmedPhone = Silian_contactPhone.trim();

    if (!Silian_trimmedAddress) {
      Silian_newErrors.deliveryAddress = Silian_t('store.exchange.addressRequired');
    }

    if (Silian_trimmedPhone) {
      if (!Silian_trimmedAreaCode) {
        Silian_newErrors.contactAreaCode = Silian_t('store.exchange.areaCodeRequired');
      } else if (!/^\+?\d{1,5}$/.test(Silian_trimmedAreaCode)) {
        Silian_newErrors.contactAreaCode = Silian_t('store.exchange.invalidAreaCode');
      }

      if (!/^[0-9\-\s]{5,20}$/.test(Silian_trimmedPhone)) {
        Silian_newErrors.contactPhone = Silian_t('store.exchange.invalidPhone');
      }
    } else if (Silian_trimmedAreaCode) {
      Silian_newErrors.contactPhone = Silian_t('store.exchange.phoneRequiredWhenAreaCode');
    }

    Silian_setErrors(Silian_newErrors);
    return Object.keys(Silian_newErrors).length === 0;
  };

  const Silian_handleSubmit = (Silian_e) => {
    Silian_e.preventDefault();
    if (!Silian_validateForm()) return;

    const Silian_trimmedAddress = Silian_deliveryAddress.trim();
    const Silian_trimmedAreaCode = Silian_contactAreaCode.trim();
    const Silian_trimmedPhone = Silian_contactPhone.trim();
    const Silian_trimmedNotes = Silian_notes.trim();

    Silian_onConfirm({
      product_id: Silian_product.id,
      quantity: Silian_quantity,
      delivery_address: Silian_trimmedAddress,
      contact_area_code: Silian_trimmedAreaCode || undefined,
      contact_phone: Silian_trimmedPhone || undefined,
      notes: Silian_trimmedNotes || undefined
    });
  };

  const Silian_handleQuantityChange = (Silian_newQuantity) => {
    const Silian_qty = Math.max(1, Math.min(Silian_maxQuantity, parseInt(Silian_newQuantity) || 1));
    Silian_setQuantity(Silian_qty);
    if (Silian_errors.quantity) {
      Silian_setErrors(Silian_prev => ({ ...Silian_prev, quantity: null }));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-border bg-card">
        <Silian_Card className="border-0 shadow-none">
          <Silian_CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <Silian_CardTitle className="text-xl">{Silian_t('store.exchange.title')}</Silian_CardTitle>
              <Silian_CardDescription>{Silian_t('store.exchange.subtitle')}</Silian_CardDescription>
            </div>
            <Silian_Button
              variant="ghost"
              size="sm"
              onClick={Silian_onClose}
              className="h-8 w-8 p-0"
            >
              <Silian_X className="h-4 w-4" />
            </Silian_Button>
          </Silian_CardHeader>

          <Silian_CardContent className="space-y-6">
            {/* 商品信息 */}
            <div className="rounded-lg bg-muted/50 p-4">
              <div className="flex items-start space-x-4">
                {Silian_hasImage && (
                  <Silian_R2Image
                    src={Silian_imageSrc || undefined}
                    filePath={Silian_imagePath || undefined}
                    alt={Silian_product.name}
                    className="w-20 h-20 object-cover rounded-lg"
                  />
                )}
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{Silian_product.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{Silian_product.description}</p>
                  <div className="flex items-center space-x-4 mt-2">
                    <div className="flex items-center space-x-1">
                      <span className="text-lg font-bold text-green-600">
                        {Silian_formatNumber(Silian_product.points_required)}
                      </span>
                      <span className="text-sm text-muted-foreground">{Silian_t('common.points')}</span>
                    </div>
                    <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                      <Silian_Package className="h-4 w-4" />
                      <span>
                        {Silian_product.stock === -1
                          ? Silian_t('store.unlimited')
                          : Silian_t('store.stock', { count: Silian_product.stock })
                        }
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <form onSubmit={Silian_handleSubmit} className="space-y-4">
              {/* 数量选择 */}
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  {Silian_t('store.exchange.quantity')}
                </label>
                <div className="flex items-center space-x-3">
                  <Silian_Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => Silian_handleQuantityChange(Silian_quantity - 1)}
                    disabled={Silian_quantity <= 1}
                  >
                    -
                  </Silian_Button>
                  <Silian_Input
                    type="number"
                    min="1"
                    max={Silian_maxQuantity}
                    value={Silian_quantity}
                    onChange={(Silian_e) => Silian_handleQuantityChange(Silian_e.target.value)}
                    className="w-20 text-center"
                  />
                  <Silian_Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => Silian_handleQuantityChange(Silian_quantity + 1)}
                    disabled={Silian_quantity >= Silian_maxQuantity}
                  >
                    +
                  </Silian_Button>
                  <span className="text-sm text-muted-foreground">
                    {Silian_t('store.exchange.maxQuantity', { max: Silian_maxQuantity })}
                  </span>
                </div>
                {Silian_errors.quantity && (
                  <p className="text-red-500 text-sm mt-1">{Silian_errors.quantity}</p>
                )}
              </div>

              {/* 收货地址 */}
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  <Silian_MapPin className="h-4 w-4 inline mr-1" />
                  {Silian_t('store.exchange.deliveryAddress')}
                </label>
                <Silian_Input
                  type="text"
                  value={Silian_deliveryAddress}
                  onChange={(Silian_e) => {
                    Silian_setDeliveryAddress(Silian_e.target.value);
                    if (Silian_errors.deliveryAddress) {
                      Silian_setErrors(Silian_prev => ({ ...Silian_prev, deliveryAddress: null }));
                    }
                  }}
                  placeholder={Silian_t('store.exchange.addressPlaceholder')}
                  className={Silian_errors.deliveryAddress ? 'border-red-500' : ''}
                />
                <p className="mt-1 text-sm text-muted-foreground">
                  {Silian_t('store.exchange.addressHint')}
                </p>
                {Silian_errors.deliveryAddress && (
                  <p className="text-red-500 text-sm mt-1">{Silian_errors.deliveryAddress}</p>
                )}
              </div>

              {/* 联系方式 */}
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  <Silian_Phone className="h-4 w-4 inline mr-1" />
                  {Silian_t('store.exchange.contactPhone')} ({Silian_t('common.optional')})
                </label>
                <div className="flex flex-col md:flex-row gap-3">
                  <div className="md:w-32">
                    <Silian_Input
                      type="text"
                      value={Silian_contactAreaCode}
                      onChange={(Silian_e) => {
                        const Silian_value = Silian_e.target.value;
                        Silian_setContactAreaCode(Silian_value);
                        if (Silian_errors.contactAreaCode) {
                          Silian_setErrors(Silian_prev => ({ ...Silian_prev, contactAreaCode: null }));
                        }
                      }}
                      placeholder={Silian_t('store.exchange.areaCodePlaceholder')}
                      className={Silian_errors.contactAreaCode ? 'border-red-500' : ''}
                    />
                    {Silian_errors.contactAreaCode && (
                      <p className="text-red-500 text-sm mt-1">{Silian_errors.contactAreaCode}</p>
                    )}
                  </div>
                  <div className="flex-1">
                    <Silian_Input
                      type="tel"
                      value={Silian_contactPhone}
                      onChange={(Silian_e) => {
                        Silian_setContactPhone(Silian_e.target.value);
                        Silian_setErrors(Silian_prev => ({
                          ...Silian_prev,
                          contactPhone: null,
                          contactAreaCode: null
                        }));
                      }}
                      placeholder={Silian_t('store.exchange.phonePlaceholder')}
                      className={Silian_errors.contactPhone ? 'border-red-500' : ''}
                    />
                    {Silian_errors.contactPhone && (
                      <p className="text-red-500 text-sm mt-1">{Silian_errors.contactPhone}</p>
                    )}
                  </div>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{Silian_t('store.exchange.phoneOptionalHint')}</p>
              </div>

              {/* 备注 */}
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  <Silian_MessageSquare className="h-4 w-4 inline mr-1" />
                  {Silian_t('store.exchange.notes')} ({Silian_t('common.optional')})
                </label>
                <textarea
                  value={Silian_notes}
                  onChange={(Silian_e) => Silian_setNotes(Silian_e.target.value)}
                  placeholder={Silian_t('store.exchange.notesPlaceholder')}
                  rows={3}
                  className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-foreground focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              {/* 费用汇总 */}
              <div className="rounded-lg bg-blue-500/10 p-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span>{Silian_t('store.exchange.unitPrice')}:</span>
                    <span>{Silian_formatNumber(Silian_product.points_required)} {Silian_t('common.points')}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>{Silian_t('store.exchange.quantity')}:</span>
                    <span>{Silian_quantity}</span>
                  </div>
                  <hr className="border-border" />
                  <div className="flex justify-between items-center font-semibold text-lg">
                    <span>{Silian_t('store.exchange.totalCost')}:</span>
                    <span className="text-green-600">
                      {Silian_formatNumber(Silian_totalPoints)} {Silian_t('common.points')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{Silian_t('store.exchange.currentPoints')}:</span>
                    <span>{Silian_formatNumber(Silian_userPoints)} {Silian_t('common.points')}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span>{Silian_t('store.exchange.afterExchange')}:</span>
                    <span className={Silian_canAfford ? 'text-green-600' : 'text-red-600'}>
                      {Silian_formatNumber(Silian_userPoints - Silian_totalPoints)} {Silian_t('common.points')}
                    </span>
                  </div>
                </div>
              </div>

              {/* 提交按钮 */}
              <div className="flex space-x-3 pt-4">
                <Silian_Button
                  type="button"
                  variant="outline"
                  onClick={Silian_onClose}
                  className="flex-1"
                  disabled={Silian_isLoading}
                >
                  {Silian_t('common.cancel')}
                </Silian_Button>
                <Silian_Button
                  type="submit"
                  disabled={!Silian_canAfford || Silian_isLoading}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  {Silian_isLoading ? (
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>{Silian_t('store.exchange.processing')}</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <Silian_ShoppingCart className="h-4 w-4" />
                      <span>{Silian_t('store.exchange.confirm')}</span>
                    </div>
                  )}
                </Silian_Button>
              </div>
            </form>
          </Silian_CardContent>
        </Silian_Card>
      </div>
    </div>
  );
}

