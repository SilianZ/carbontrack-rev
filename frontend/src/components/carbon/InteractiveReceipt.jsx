import Silian_React, { useEffect as Silian_useEffect, useMemo as Silian_useMemo, useRef as Silian_useRef, useState as Silian_useState } from 'react';
import {
  ACESFilmicToneMapping as Silian_ACESFilmicToneMapping,
  AmbientLight as Silian_AmbientLight,
  BoxGeometry as Silian_BoxGeometry,
  CanvasTexture as Silian_CanvasTexture,
  Color as Silian_Color,
  DirectionalLight as Silian_DirectionalLight,
  DoubleSide as Silian_DoubleSide,
  DynamicDrawUsage as Silian_DynamicDrawUsage,
  Mesh as Silian_Mesh,
  MeshPhysicalMaterial as Silian_MeshPhysicalMaterial,
  MeshStandardMaterial as Silian_MeshStandardMaterial,
  PCFSoftShadowMap as Silian_PCFSoftShadowMap,
  PerspectiveCamera as Silian_PerspectiveCamera,
  Plane as Silian_Plane,
  PlaneGeometry as Silian_PlaneGeometry,
  PointLight as Silian_PointLight,
  Raycaster as Silian_Raycaster,
  SRGBColorSpace as Silian_SRGBColorSpace,
  Scene as Silian_Scene,
  Vector2 as Silian_Vector2,
  Vector3 as Silian_Vector3,
  WebGLRenderer as Silian_WebGLRenderer,
} from 'three';
import {
  CheckCircle2 as Silian_CheckCircle2,
  RotateCcw as Silian_RotateCcw,
} from 'lucide-react';
import { Button as Silian_Button } from '../ui/Button';
import { useTranslation as Silian_useTranslation } from '../../hooks/useTranslation';

const Silian_SIMULATION_STEP = 1 / 120;
const Silian_MAX_FRAME_DELTA = 1 / 24;
const Silian_CONSTRAINT_ITERATIONS = 6;
const Silian_RECEIPT_WIDTH = 1.16;
const Silian_RECEIPT_HEIGHT = 2.42;
const Silian_MAX_DRAG_DISTANCE = 1.4;

function Silian_clamp(Silian_value, Silian_min, Silian_max) {
  return Math.min(Silian_max, Math.max(Silian_min, Silian_value));
}

function Silian_safeNumber(Silian_value, Silian_fallback = 0) {
  const Silian_number = typeof Silian_value === 'number' ? Silian_value : Number(Silian_value);
  return Number.isFinite(Silian_number) ? Silian_number : Silian_fallback;
}

function Silian_formatNumber(Silian_value, Silian_locale, Silian_options = {}) {
  return new Intl.NumberFormat(Silian_locale, Silian_options).format(Silian_safeNumber(Silian_value));
}

function Silian_formatDate(Silian_value, Silian_locale, Silian_options = {}) {
  if (!Silian_value) {
    return '—';
  }

  const Silian_date = new Date(Silian_value);
  if (Number.isNaN(Silian_date.getTime())) {
    return String(Silian_value);
  }

  return new Intl.DateTimeFormat(Silian_locale, Silian_options).format(Silian_date);
}

function Silian_getActivityName(Silian_activity, Silian_isZh) {
  if (!Silian_activity) {
    return Silian_isZh ? '未命名活动' : 'Untitled activity';
  }

  return Silian_isZh
    ? (Silian_activity.name_zh || Silian_activity.name_en || Silian_activity.name || '未命名活动')
    : (Silian_activity.name_en || Silian_activity.name_zh || Silian_activity.name || 'Untitled activity');
}

function Silian_wrapText(Silian_ctx, Silian_text, Silian_maxWidth) {
  const Silian_content = String(Silian_text || '').trim();
  if (!Silian_content) {
    return [];
  }

  const Silian_paragraphs = Silian_content.split(/\r?\n/);
  const Silian_lines = [];

  Silian_paragraphs.forEach((Silian_paragraph) => {
    if (!Silian_paragraph.trim()) {
      Silian_lines.push('');
      return;
    }

    let Silian_line = '';
    for (const Silian_char of Silian_paragraph) {
      const Silian_nextLine = Silian_line + Silian_char;
      if (Silian_line && Silian_ctx.measureText(Silian_nextLine).width > Silian_maxWidth) {
        Silian_lines.push(Silian_line);
        Silian_line = Silian_char;
      } else {
        Silian_line = Silian_nextLine;
      }
    }

    if (Silian_line) {
      Silian_lines.push(Silian_line);
    }
  });

  return Silian_lines;
}

function Silian_drawReceiptTexture(Silian_data, Silian_isZh) {
  const Silian_canvas = document.createElement('canvas');
  Silian_canvas.width = 1024;
  Silian_canvas.height = 2048;
  const Silian_ctx = Silian_canvas.getContext('2d');

  if (!Silian_ctx) {
    return Silian_canvas;
  }

  const Silian_thermalWhite = '#fffdf5';
  const Silian_thermalShadow = '#ede7da';
  const Silian_ink = '#272623';
  const Silian_mutedInk = '#7c766a';
  const Silian_accent = '#0f8c53';

  Silian_ctx.fillStyle = Silian_thermalWhite;
  Silian_ctx.fillRect(0, 0, Silian_canvas.width, Silian_canvas.height);

  Silian_ctx.globalAlpha = 0.08;
  for (let Silian_i = 0; Silian_i < 3800; Silian_i += 1) {
    const Silian_x = Math.random() * Silian_canvas.width;
    const Silian_y = Math.random() * Silian_canvas.height;
    const Silian_width = Math.random() * 2 + 0.5;
    const Silian_height = Math.random() * 2 + 0.5;
    Silian_ctx.fillStyle = Silian_i % 7 === 0 ? '#d7cfbd' : '#cec7ba';
    Silian_ctx.fillRect(Silian_x, Silian_y, Silian_width, Silian_height);
  }

  Silian_ctx.globalAlpha = 0.06;
  for (let Silian_y = 0; Silian_y < Silian_canvas.height; Silian_y += 6) {
    Silian_ctx.fillStyle = Silian_y % 18 === 0 ? '#cfc8b8' : '#dbd4c5';
    Silian_ctx.fillRect(0, Silian_y, Silian_canvas.width, 1);
  }
  Silian_ctx.globalAlpha = 1;

  Silian_ctx.fillStyle = Silian_thermalShadow;
  Silian_ctx.fillRect(0, 36, Silian_canvas.width, 10);

  let Silian_cursorY = 92;
  const Silian_marginX = 76;
  const Silian_innerWidth = Silian_canvas.width - Silian_marginX * 2;

  Silian_ctx.fillStyle = Silian_accent;
  Silian_ctx.font = `700 ${Silian_isZh ? 58 : 60}px "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif`;
  Silian_ctx.fillText('CARBONTRACK', Silian_marginX, Silian_cursorY);

  Silian_ctx.fillStyle = Silian_mutedInk;
  Silian_ctx.font = `500 ${Silian_isZh ? 25 : 24}px "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif`;
  Silian_ctx.fillText(Silian_data.receiptTitle, Silian_marginX, Silian_cursorY + 66);
  Silian_ctx.fillText(`#${Silian_data.recordId}`, Silian_canvas.width - Silian_marginX - Silian_ctx.measureText(`#${Silian_data.recordId}`).width, Silian_cursorY + 66);

  Silian_cursorY += 128;

  Silian_ctx.strokeStyle = '#302f2a';
  Silian_ctx.lineWidth = 2;
  Silian_ctx.setLineDash([6, 8]);
  Silian_ctx.beginPath();
  Silian_ctx.moveTo(Silian_marginX, Silian_cursorY);
  Silian_ctx.lineTo(Silian_canvas.width - Silian_marginX, Silian_cursorY);
  Silian_ctx.stroke();
  Silian_ctx.setLineDash([]);

  Silian_cursorY += 34;

  const Silian_labelFont = `600 ${Silian_isZh ? 24 : 22}px "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif`;
  const Silian_valueFont = `500 ${Silian_isZh ? 29 : 28}px "Cascadia Mono", "SFMono-Regular", Consolas, monospace`;

  const Silian_drawPair = (Silian_label, Silian_value) => {
    Silian_ctx.fillStyle = Silian_mutedInk;
    Silian_ctx.font = Silian_labelFont;
    Silian_ctx.fillText(Silian_label, Silian_marginX, Silian_cursorY);

    Silian_ctx.fillStyle = Silian_ink;
    Silian_ctx.font = Silian_valueFont;
    const Silian_wrapped = Silian_wrapText(Silian_ctx, Silian_value, Silian_innerWidth);
    let Silian_localY = Silian_cursorY + 30;
    Silian_wrapped.forEach((Silian_line) => {
      Silian_ctx.fillText(Silian_line, Silian_marginX, Silian_localY);
      Silian_localY += 36;
    });

    Silian_cursorY = Silian_localY + 18;
  };

  Silian_drawPair(Silian_data.activityLabel, Silian_data.activityName);
  Silian_drawPair(Silian_data.categoryLabel, Silian_data.categoryName);
  Silian_drawPair(Silian_data.amountLabel, Silian_data.amountLine);
  Silian_drawPair(Silian_data.factorLabel, Silian_data.factorLine);
  Silian_drawPair(Silian_data.activityDateLabel, Silian_data.activityDate);

  if (Silian_data.checkinDate) {
    Silian_drawPair(Silian_data.checkinLabel, Silian_data.checkinDate);
  }

  Silian_drawPair(Silian_data.submittedAtLabel, Silian_data.submittedAt);
  Silian_drawPair(Silian_data.imageCountLabel, Silian_data.imageCount);

  Silian_ctx.fillStyle = '#1e1d1a';
  Silian_ctx.fillRect(Silian_marginX, Silian_cursorY + 10, Silian_innerWidth, 3);
  Silian_cursorY += 46;

  Silian_ctx.fillStyle = Silian_mutedInk;
  Silian_ctx.font = Silian_labelFont;
  Silian_ctx.fillText(Silian_data.formulaLabel, Silian_marginX, Silian_cursorY);

  Silian_cursorY += 34;
  Silian_ctx.fillStyle = Silian_ink;
  Silian_ctx.font = `700 ${Silian_isZh ? 38 : 36}px "Cascadia Mono", "SFMono-Regular", Consolas, monospace`;
  Silian_wrapText(Silian_ctx, Silian_data.formulaLine, Silian_innerWidth).forEach((Silian_line) => {
    Silian_ctx.fillText(Silian_line, Silian_marginX, Silian_cursorY);
    Silian_cursorY += 48;
  });

  Silian_cursorY += 14;

  Silian_ctx.strokeStyle = '#302f2a';
  Silian_ctx.lineWidth = 2;
  Silian_ctx.beginPath();
  Silian_ctx.moveTo(Silian_marginX, Silian_cursorY);
  Silian_ctx.lineTo(Silian_canvas.width - Silian_marginX, Silian_cursorY);
  Silian_ctx.stroke();

  Silian_cursorY += 34;

  Silian_ctx.fillStyle = Silian_mutedInk;
  Silian_ctx.font = Silian_labelFont;
  Silian_ctx.fillText(Silian_data.descriptionLabel, Silian_marginX, Silian_cursorY);
  Silian_cursorY += 30;

  Silian_ctx.fillStyle = Silian_ink;
  Silian_ctx.font = `500 ${Silian_isZh ? 28 : 26}px "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif`;
  Silian_wrapText(Silian_ctx, Silian_data.descriptionValue, Silian_innerWidth).slice(0, 6).forEach((Silian_line) => {
    Silian_ctx.fillText(Silian_line || ' ', Silian_marginX, Silian_cursorY);
    Silian_cursorY += 38;
  });

  Silian_cursorY += 12;
  Silian_ctx.fillStyle = Silian_thermalShadow;
  Silian_ctx.fillRect(Silian_marginX, Silian_cursorY, Silian_innerWidth, 1);
  Silian_cursorY += 34;

  Silian_ctx.fillStyle = Silian_mutedInk;
  Silian_ctx.font = `500 ${Silian_isZh ? 22 : 20}px "Cascadia Mono", "SFMono-Regular", Consolas, monospace`;
  Silian_ctx.fillText(Silian_data.footerLineOne, Silian_marginX, Silian_cursorY);
  Silian_cursorY += 30;
  Silian_ctx.fillText(Silian_data.footerLineTwo, Silian_marginX, Silian_cursorY);

  return Silian_canvas;
}

function Silian_ReceiptFallback({ summary: Silian_summary, onRestart: Silian_onRestart, onGoDashboard: Silian_onGoDashboard }) {
  return (
    <div className="overflow-hidden rounded-[36px] border border-black/6 bg-[#fcfcf9] text-slate-900 shadow-[0_32px_100px_-54px_rgba(15,23,42,0.45)]">
      <div className="mx-auto flex max-w-[1040px] flex-col gap-8 px-6 py-6 lg:px-10 lg:py-10">
        <div className="max-w-[640px] space-y-5">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/12 text-emerald-600">
            <Silian_CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-emerald-600">
              {Silian_summary.successEyebrow}
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              {Silian_summary.successTitle}
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {Silian_summary.successDescription}
            </p>
          </div>
        </div>

        <div className="rounded-[30px] border border-[#ece7da] bg-[#fffdf5] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_20px_60px_-40px_rgba(15,23,42,0.35)]">
          <div className="mx-auto max-w-[440px] font-mono text-[13px] text-[#25231f]">
            <div className="border-b border-dashed border-[#2c2a26] pb-4">
              <p className="text-lg font-bold tracking-[0.26em] text-emerald-600">CARBONTRACK</p>
              <p className="mt-2 text-[#716b61]">{Silian_summary.receiptTitle}</p>
            </div>
            <div className="space-y-4 py-4">
              {Silian_summary.printLines.map((Silian_line) => (
                <div key={Silian_line.label}>
                  <p className="text-[#716b61]">{Silian_line.label}</p>
                  <p className="mt-1 text-[15px] font-semibold">{Silian_line.value}</p>
                </div>
              ))}
            </div>
            <div className="border-t border-b border-[#2c2a26] py-4">
              <p className="text-[#716b61]">{Silian_summary.formulaLabel}</p>
              <p className="mt-2 text-[16px] font-bold">{Silian_summary.formulaLine}</p>
            </div>
            <div className="space-y-3 py-4">
              <div>
                <p className="text-[#716b61]">{Silian_summary.descriptionLabel}</p>
                <p className="mt-1 text-[15px] leading-6">{Silian_summary.descriptionValue}</p>
              </div>
              <div className="border-t border-[#d9d2c5] pt-3 text-[#716b61]">
                <p>{Silian_summary.footerLineOne}</p>
                <p className="mt-2">{Silian_summary.footerLineTwo}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Silian_Button onClick={Silian_onRestart} className="bg-slate-950 text-white hover:bg-slate-800">
            {Silian_summary.actions.restart}
          </Silian_Button>
          <Silian_Button
            variant="outline"
            onClick={Silian_onGoDashboard}
            className="border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
          >
            {Silian_summary.actions.dashboard}
          </Silian_Button>
        </div>
      </div>
    </div>
  );
}

export function InteractiveReceipt({ receipt: Silian_receipt, onRestart: Silian_onRestart, onGoDashboard: Silian_onGoDashboard }) {
  const { t: Silian_t, currentLanguage: Silian_currentLanguage } = Silian_useTranslation(['activities', 'date', 'images', 'units']);
  const Silian_stageRef = Silian_useRef(null);
  const Silian_motionCardRef = Silian_useRef(null);
  const [Silian_webglUnavailable, Silian_setWebglUnavailable] = Silian_useState(false);

  const Silian_locale = Silian_currentLanguage?.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US';
  const Silian_isZh = Silian_locale === 'zh-CN';

  const Silian_summary = Silian_useMemo(() => {
    const Silian_amount = Silian_safeNumber(Silian_receipt?.amount);
    const Silian_factor = Silian_safeNumber(Silian_receipt?.activity?.carbon_factor);
    const Silian_carbonSaved = Silian_safeNumber(Silian_receipt?.carbon_saved);
    const Silian_imageCount = Array.isArray(Silian_receipt?.images) ? Silian_receipt.images.length : Silian_safeNumber(Silian_receipt?.image_count);
    const Silian_activityName = Silian_getActivityName(Silian_receipt?.activity, Silian_isZh);
    const Silian_categoryName = Silian_t(`activities.categories.${Silian_receipt?.activity?.category}`, {
      defaultValue: Silian_receipt?.activity?.category || (Silian_isZh ? '未分类' : 'Uncategorized'),
    });
    const Silian_unitName = Silian_t(`units.${Silian_receipt?.activity?.unit}`, {
      defaultValue: Silian_receipt?.activity?.unit || (Silian_isZh ? '单位' : 'unit'),
    });
    const Silian_factorLine = `${Silian_formatNumber(Silian_factor, Silian_locale, {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    })} kg CO₂ / ${Silian_unitName}`;
    const Silian_amountLine = `${Silian_formatNumber(Silian_amount, Silian_locale, {
      minimumFractionDigits: Silian_amount % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    })} ${Silian_unitName}`;
    const Silian_formulaLine = `${Silian_formatNumber(Silian_amount, Silian_locale, {
      minimumFractionDigits: Silian_amount % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    })} ${Silian_unitName} × ${Silian_formatNumber(Silian_factor, Silian_locale, {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    })} = ${Silian_formatNumber(Silian_carbonSaved, Silian_locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} kg CO₂`;
    const Silian_activityDate = Silian_formatDate(Silian_receipt?.date, Silian_locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const Silian_checkinDate = Silian_receipt?.checkin_date
      ? Silian_formatDate(Silian_receipt.checkin_date, Silian_locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
      : '';
    const Silian_submittedAt = Silian_formatDate(Silian_receipt?.submitted_at, Silian_locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    const Silian_descriptionValue = String(Silian_receipt?.description || '').trim()
      || (Silian_isZh ? '无附加备注。' : 'No extra note.');

    return {
      successEyebrow: 'THERMAL RECEIPT',
      successTitle: Silian_t('activities.form.submitSuccess', {
        defaultValue: Silian_isZh ? '记录提交成功' : 'Submission complete',
      }),
      successDescription: Silian_isZh
        ? '核算详情已生成热敏小票，你可以直接查看完整记录。'
        : 'The calculation details are now printed on a thermal-style receipt for direct review.',
      receiptTitle: Silian_isZh ? '减碳核算回执' : 'Carbon Reduction Receipt',
      recordId: Silian_receipt?.record_id ?? '—',
      activityLabel: Silian_isZh ? '活动项目' : 'Activity',
      activityName: Silian_activityName,
      categoryLabel: Silian_isZh ? '分类' : 'Category',
      categoryName: Silian_categoryName,
      amountLabel: Silian_isZh ? '提交数值' : 'Submitted amount',
      amountLine: Silian_amountLine,
      factorLabel: Silian_isZh ? '减排系数' : 'Carbon factor',
      factorLine: Silian_factorLine,
      activityDateLabel: Silian_isZh ? '活动日期' : 'Activity date',
      activityDate: Silian_activityDate,
      checkinLabel: Silian_isZh ? '补签日期' : 'Check-in date',
      checkinDate: Silian_checkinDate,
      submittedAtLabel: Silian_isZh ? '提交时间' : 'Submitted at',
      submittedAt: Silian_submittedAt,
      imageCountLabel: Silian_isZh ? '凭证张数' : 'Proof images',
      imageCount: Silian_isZh ? `${Silian_imageCount} 张` : `${Silian_imageCount} files`,
      formulaLabel: Silian_isZh ? '核算公式' : 'Calculation formula',
      formulaLine: Silian_formulaLine,
      descriptionLabel: Silian_isZh ? '备注 / 审核提示' : 'Notes / review memo',
      descriptionValue: Silian_descriptionValue,
      footerLineOne: Silian_isZh
        ? '此回执已进入人工审核队列，请保留凭证。'
        : 'This receipt is queued for manual review. Keep your proof ready.',
      footerLineTwo: 'CarbonTrack · thermal log snapshot',
      actions: {
        restart: Silian_t('activities.form.recordAnother', {
          defaultValue: Silian_isZh ? '继续记录下一条' : 'Record another',
        }),
        dashboard: Silian_t('activities.form.goToDashboard', {
          defaultValue: Silian_isZh ? '返回仪表盘' : 'Go to dashboard',
        }),
      },
      printLines: [
        { label: Silian_isZh ? '活动项目' : 'Activity', value: Silian_activityName },
        { label: Silian_isZh ? '分类' : 'Category', value: Silian_categoryName },
        { label: Silian_isZh ? '提交数值' : 'Submitted amount', value: Silian_amountLine },
        { label: Silian_isZh ? '减排系数' : 'Carbon factor', value: Silian_factorLine },
        { label: Silian_isZh ? '活动日期' : 'Activity date', value: Silian_activityDate },
      ],
    };
  }, [Silian_isZh, Silian_locale, Silian_receipt, Silian_t]);

  Silian_useEffect(() => {
    const Silian_motionCard = Silian_motionCardRef.current;
    if (!Silian_motionCard || typeof window === 'undefined') {
      return undefined;
    }

    const Silian_prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const Silian_isCoarsePointer = window.matchMedia?.('(pointer: coarse)').matches;

    if (Silian_prefersReducedMotion || !Silian_isCoarsePointer) {
      Silian_motionCard.style.transform = '';
      return undefined;
    }

    let Silian_animationFrameId = 0;
    let Silian_listening = false;
    const Silian_current = { x: 0, y: 0, rotateX: 0, rotateY: 0 };
    const Silian_target = { x: 0, y: 0, rotateX: 0, rotateY: 0 };

    const Silian_applyTransform = () => {
      Silian_current.x += (Silian_target.x - Silian_current.x) * 0.12;
      Silian_current.y += (Silian_target.y - Silian_current.y) * 0.12;
      Silian_current.rotateX += (Silian_target.rotateX - Silian_current.rotateX) * 0.12;
      Silian_current.rotateY += (Silian_target.rotateY - Silian_current.rotateY) * 0.12;

      Silian_motionCard.style.transform = `perspective(1400px) translate3d(${Silian_current.x.toFixed(2)}px, ${Silian_current.y.toFixed(2)}px, 0) rotateX(${Silian_current.rotateX.toFixed(2)}deg) rotateY(${Silian_current.rotateY.toFixed(2)}deg)`;
      Silian_animationFrameId = window.requestAnimationFrame(Silian_applyTransform);
    };

    const Silian_handleOrientation = (Silian_event) => {
      const Silian_gamma = Silian_clamp(Silian_safeNumber(Silian_event.gamma), -18, 18);
      const Silian_beta = Silian_clamp(Silian_safeNumber(Silian_event.beta) - 28, -20, 20);

      Silian_target.x = Silian_gamma * 0.7;
      Silian_target.y = Silian_beta * -0.55;
      Silian_target.rotateX = Silian_beta * -0.18;
      Silian_target.rotateY = Silian_gamma * 0.24;
    };

    const Silian_startListening = () => {
      if (Silian_listening) {
        return;
      }

      window.addEventListener('deviceorientation', Silian_handleOrientation, true);
      Silian_listening = true;
    };

    const Silian_requestOrientationAccess = async () => {
      try {
        if (
          typeof DeviceOrientationEvent !== 'undefined'
          && typeof DeviceOrientationEvent.requestPermission === 'function'
        ) {
          const Silian_permission = await DeviceOrientationEvent.requestPermission();
          if (Silian_permission === 'granted') {
            Silian_startListening();
          }
          return;
        }

        Silian_startListening();
      } catch (Silian_error) {
        console.error('Unable to enable device orientation for receipt card', Silian_error);
      }
    };

    const Silian_handleGesture = () => {
      Silian_requestOrientationAccess();
    };

    Silian_motionCard.style.willChange = 'transform';
    Silian_animationFrameId = window.requestAnimationFrame(Silian_applyTransform);
    window.addEventListener('touchstart', Silian_handleGesture, { passive: true });
    window.addEventListener('pointerdown', Silian_handleGesture, { passive: true });

    return () => {
      window.cancelAnimationFrame(Silian_animationFrameId);
      window.removeEventListener('touchstart', Silian_handleGesture);
      window.removeEventListener('pointerdown', Silian_handleGesture);
      if (Silian_listening) {
        window.removeEventListener('deviceorientation', Silian_handleOrientation, true);
      }
      Silian_motionCard.style.willChange = '';
      Silian_motionCard.style.transform = '';
    };
  }, []);

  Silian_useEffect(() => {
    const Silian_container = Silian_stageRef.current;
    if (!Silian_container || Silian_webglUnavailable) {
      return undefined;
    }

    let Silian_animationFrameId = 0;
    let Silian_resizeObserver;
    let Silian_visibilityHandler;
    let Silian_renderer;

    try {
      Silian_renderer = new Silian_WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      });
    } catch (Silian_error) {
      console.error('Unable to create WebGL renderer for receipt scene', Silian_error);
      Silian_setWebglUnavailable(true);
      return undefined;
    }

    const Silian_scene = new Silian_Scene();
    const Silian_camera = new Silian_PerspectiveCamera(30, 1, 0.1, 20);
    Silian_camera.position.set(0, 0.08, 4.55);
    Silian_camera.lookAt(0, 0.03, 0);

    Silian_renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    Silian_renderer.setClearColor('#ffffff', 1);
    Silian_renderer.outputColorSpace = Silian_SRGBColorSpace;
    Silian_renderer.toneMapping = Silian_ACESFilmicToneMapping;
    Silian_renderer.toneMappingExposure = 1.05;
    Silian_renderer.shadowMap.enabled = true;
    Silian_renderer.shadowMap.type = Silian_PCFSoftShadowMap;
    Silian_renderer.domElement.className = 'h-full w-full touch-none select-none';
    Silian_renderer.domElement.style.cursor = 'grab';
    Silian_container.innerHTML = '';
    Silian_container.appendChild(Silian_renderer.domElement);

    const Silian_ambientLight = new Silian_AmbientLight(0xffffff, 1.3);
    Silian_scene.add(Silian_ambientLight);

    const Silian_keyLight = new Silian_DirectionalLight(0xffffff, 1.5);
    Silian_keyLight.position.set(1.8, 2.4, 3.1);
    Silian_keyLight.castShadow = true;
    Silian_keyLight.shadow.mapSize.set(1024, 1024);
    Silian_keyLight.shadow.camera.near = 0.5;
    Silian_keyLight.shadow.camera.far = 10;
    Silian_keyLight.shadow.camera.left = -3;
    Silian_keyLight.shadow.camera.right = 3;
    Silian_keyLight.shadow.camera.top = 3;
    Silian_keyLight.shadow.camera.bottom = -3;
    Silian_keyLight.shadow.bias = -0.0002;
    Silian_scene.add(Silian_keyLight);

    const Silian_fillLight = new Silian_DirectionalLight(0xeef6ff, 0.5);
    Silian_fillLight.position.set(-2.2, 0.8, 1.4);
    Silian_scene.add(Silian_fillLight);

    const Silian_warmLight = new Silian_PointLight(0xfff2cf, 0.35, 6, 2);
    Silian_warmLight.position.set(0.4, -1.25, 1.1);
    Silian_scene.add(Silian_warmLight);

    const Silian_backdrop = new Silian_Mesh(
      new Silian_PlaneGeometry(6.4, 6.4),
      new Silian_MeshStandardMaterial({
        color: '#ffffff',
        roughness: 1,
        metalness: 0,
      }),
    );
    Silian_backdrop.position.set(0, -0.04, -1.05);
    Silian_backdrop.receiveShadow = true;
    Silian_scene.add(Silian_backdrop);

    const Silian_textureCanvas = Silian_drawReceiptTexture(Silian_summary, Silian_isZh);
    const Silian_receiptTexture = new Silian_CanvasTexture(Silian_textureCanvas);
    Silian_receiptTexture.colorSpace = Silian_SRGBColorSpace;
    Silian_receiptTexture.anisotropy = Silian_renderer.capabilities.getMaxAnisotropy
      ? Math.min(4, Silian_renderer.capabilities.getMaxAnisotropy())
      : 1;

    const Silian_segmentsX = Silian_container.clientWidth >= 960 ? 30 : 24;
    const Silian_segmentsY = Silian_container.clientWidth >= 960 ? 56 : 48;
    const Silian_columnCount = Silian_segmentsX + 1;
    const Silian_rowCount = Silian_segmentsY + 1;
    const Silian_particleCount = Silian_columnCount * Silian_rowCount;
    const Silian_positions = new Float32Array(Silian_particleCount * 3);
    const Silian_previousPositions = new Float32Array(Silian_particleCount * 3);
    const Silian_restPositions = new Float32Array(Silian_particleCount * 3);
    const Silian_topAnchors = new Float32Array(Silian_columnCount * 3);
    const Silian_pinned = new Uint8Array(Silian_particleCount);
    const Silian_constraints = [];

    const Silian_indexOf = (Silian_column, Silian_row) => Silian_row * Silian_columnCount + Silian_column;

    const Silian_setVector = (Silian_array, Silian_index, Silian_x, Silian_y, Silian_z) => {
      const Silian_offset = Silian_index * 3;
      Silian_array[Silian_offset] = Silian_x;
      Silian_array[Silian_offset + 1] = Silian_y;
      Silian_array[Silian_offset + 2] = Silian_z;
    };

    const Silian_getDistance = (Silian_array, Silian_first, Silian_second) => {
      const Silian_offsetA = Silian_first * 3;
      const Silian_offsetB = Silian_second * 3;
      const Silian_dx = Silian_array[Silian_offsetA] - Silian_array[Silian_offsetB];
      const Silian_dy = Silian_array[Silian_offsetA + 1] - Silian_array[Silian_offsetB + 1];
      const Silian_dz = Silian_array[Silian_offsetA + 2] - Silian_array[Silian_offsetB + 2];
      return Math.sqrt(Silian_dx * Silian_dx + Silian_dy * Silian_dy + Silian_dz * Silian_dz);
    };

    const Silian_addConstraint = (Silian_first, Silian_second, Silian_stiffness) => {
      Silian_constraints.push({
        first: Silian_first,
        second: Silian_second,
        restLength: Silian_getDistance(Silian_restPositions, Silian_first, Silian_second),
        stiffness: Silian_stiffness,
      });
    };

    for (let Silian_row = 0; Silian_row < Silian_rowCount; Silian_row += 1) {
      const Silian_v = Silian_row / Silian_segmentsY;
      for (let Silian_column = 0; Silian_column < Silian_columnCount; Silian_column += 1) {
        const Silian_u = Silian_column / Silian_segmentsX;
        const Silian_x = (Silian_u - 0.5) * Silian_RECEIPT_WIDTH;
        const Silian_y = Silian_RECEIPT_HEIGHT * 0.5 - Silian_v * Silian_RECEIPT_HEIGHT;
        const Silian_wrinkle = Math.sin(Silian_u * Math.PI * 4.3 + Silian_v * 5.6) * 0.014 * Math.pow(Silian_v, 1.45);
        const Silian_curl = Math.pow(Silian_v, 2.1) * 0.12;
        const Silian_creaseNoise = Math.cos(Silian_u * 17.4 - Silian_v * 12.7) * 0.006 * Math.pow(Silian_v, 1.65);
        const Silian_z = Silian_row === 0 ? 0 : Silian_curl + Silian_wrinkle + Silian_creaseNoise;
        const Silian_index = Silian_indexOf(Silian_column, Silian_row);

        Silian_setVector(Silian_positions, Silian_index, Silian_x, Silian_y, Silian_z);
        Silian_setVector(Silian_previousPositions, Silian_index, Silian_x, Silian_y, Silian_z);
        Silian_setVector(Silian_restPositions, Silian_index, Silian_x, Silian_y, Silian_z);

        if (Silian_row === 0) {
          Silian_pinned[Silian_index] = 1;
          Silian_setVector(Silian_topAnchors, Silian_column, Silian_x, Silian_y, 0);
        }
      }
    }

    for (let Silian_row = 0; Silian_row < Silian_rowCount; Silian_row += 1) {
      for (let Silian_column = 0; Silian_column < Silian_columnCount; Silian_column += 1) {
        const Silian_current = Silian_indexOf(Silian_column, Silian_row);
        const Silian_topBand = 1 - Silian_clamp(Silian_row / Math.max(1, Silian_segmentsY * 0.18), 0, 1);
        const Silian_structuralBoost = Silian_topBand * 0.16;
        const Silian_bendBoost = Silian_topBand * 0.12;

        if (Silian_column < Silian_segmentsX) {
          Silian_addConstraint(Silian_current, Silian_indexOf(Silian_column + 1, Silian_row), 0.82 + Silian_structuralBoost);
        }
        if (Silian_row < Silian_segmentsY) {
          Silian_addConstraint(Silian_current, Silian_indexOf(Silian_column, Silian_row + 1), 0.88 + Silian_structuralBoost);
        }
        if (Silian_column < Silian_segmentsX && Silian_row < Silian_segmentsY) {
          Silian_addConstraint(Silian_current, Silian_indexOf(Silian_column + 1, Silian_row + 1), 0.2 + Silian_topBand * 0.08);
          Silian_addConstraint(Silian_indexOf(Silian_column + 1, Silian_row), Silian_indexOf(Silian_column, Silian_row + 1), 0.2 + Silian_topBand * 0.08);
        }
        if (Silian_column < Silian_segmentsX - 1) {
          Silian_addConstraint(Silian_current, Silian_indexOf(Silian_column + 2, Silian_row), 0.12 + Silian_bendBoost);
        }
        if (Silian_row < Silian_segmentsY - 1) {
          Silian_addConstraint(Silian_current, Silian_indexOf(Silian_column, Silian_row + 2), 0.16 + Silian_bendBoost);
        }
      }
    }

    const Silian_geometry = new Silian_PlaneGeometry(Silian_RECEIPT_WIDTH, Silian_RECEIPT_HEIGHT, Silian_segmentsX, Silian_segmentsY);
    Silian_geometry.attributes.position.setUsage(Silian_DynamicDrawUsage);
    Silian_geometry.attributes.position.array.set(Silian_positions);
    Silian_geometry.computeVertexNormals();

    const Silian_receiptMaterial = new Silian_MeshPhysicalMaterial({
      color: '#fffdf7',
      map: Silian_receiptTexture,
      roughness: 0.96,
      metalness: 0,
      clearcoat: 0.06,
      clearcoatRoughness: 0.9,
      sheen: 0.22,
      sheenRoughness: 0.88,
      sheenColor: new Silian_Color('#fff9e6'),
      side: Silian_DoubleSide,
    });

    const Silian_receiptMesh = new Silian_Mesh(Silian_geometry, Silian_receiptMaterial);
    Silian_receiptMesh.position.set(0, -0.06, 0.03);
    Silian_receiptMesh.rotation.x = -0.06;
    Silian_receiptMesh.castShadow = true;
    Silian_receiptMesh.receiveShadow = true;
    Silian_scene.add(Silian_receiptMesh);

    const Silian_anchorBar = new Silian_Mesh(
      new Silian_BoxGeometry(Silian_RECEIPT_WIDTH + 0.18, 0.028, 0.12),
      new Silian_MeshStandardMaterial({
        color: '#e2e7df',
        roughness: 0.82,
        metalness: 0.08,
      }),
    );
    Silian_anchorBar.position.set(0, Silian_receiptMesh.position.y + Silian_RECEIPT_HEIGHT * 0.5 + 0.015, -0.08);
    Silian_anchorBar.castShadow = true;
    Silian_anchorBar.receiveShadow = true;
    Silian_scene.add(Silian_anchorBar);

    const Silian_raycaster = new Silian_Raycaster();
    const Silian_pointer = new Silian_Vector2();
    const Silian_dragPlane = new Silian_Plane();
    const Silian_intersectionPoint = new Silian_Vector3();
    const Silian_tempVector = new Silian_Vector3();
    const Silian_cameraDirection = new Silian_Vector3();
    const Silian_dragState = {
      active: false,
      index: -1,
      pointerId: null,
      startPoint: new Silian_Vector3(),
      target: new Silian_Vector3(),
      lastTarget: new Silian_Vector3(),
      velocity: new Silian_Vector3(),
    };

    let Silian_documentHidden = false;
    let Silian_normalFrameCounter = 0;

    const Silian_enforceTopEdge = () => {
      for (let Silian_column = 0; Silian_column < Silian_columnCount; Silian_column += 1) {
        const Silian_particleOffset = Silian_column * 3;
        const Silian_anchorOffset = Silian_column * 3;
        Silian_positions[Silian_particleOffset] = Silian_topAnchors[Silian_anchorOffset];
        Silian_positions[Silian_particleOffset + 1] = Silian_topAnchors[Silian_anchorOffset + 1];
        Silian_positions[Silian_particleOffset + 2] = Silian_topAnchors[Silian_anchorOffset + 2];
        Silian_previousPositions[Silian_particleOffset] = Silian_topAnchors[Silian_anchorOffset];
        Silian_previousPositions[Silian_particleOffset + 1] = Silian_topAnchors[Silian_anchorOffset + 1];
        Silian_previousPositions[Silian_particleOffset + 2] = Silian_topAnchors[Silian_anchorOffset + 2];
      }
    };

    const Silian_applyDragInfluence = () => {
      if (!Silian_dragState.active || Silian_dragState.index < 0) {
        return;
      }

      const Silian_mainOffset = Silian_dragState.index * 3;
      Silian_positions[Silian_mainOffset] += (Silian_dragState.target.x - Silian_positions[Silian_mainOffset]) * 0.85;
      Silian_positions[Silian_mainOffset + 1] += (Silian_dragState.target.y - Silian_positions[Silian_mainOffset + 1]) * 0.85;
      Silian_positions[Silian_mainOffset + 2] += (Silian_dragState.target.z - Silian_positions[Silian_mainOffset + 2]) * 0.92;

      const Silian_dragColumn = Silian_dragState.index % Silian_columnCount;
      const Silian_dragRow = Math.floor(Silian_dragState.index / Silian_columnCount);

      for (let Silian_row = Math.max(1, Silian_dragRow - 4); Silian_row <= Math.min(Silian_segmentsY, Silian_dragRow + 5); Silian_row += 1) {
        for (let Silian_column = Math.max(0, Silian_dragColumn - 4); Silian_column <= Math.min(Silian_segmentsX, Silian_dragColumn + 4); Silian_column += 1) {
          const Silian_index = Silian_indexOf(Silian_column, Silian_row);
          if (Silian_index === Silian_dragState.index || Silian_pinned[Silian_index]) {
            continue;
          }

          const Silian_deltaColumn = Silian_column - Silian_dragColumn;
          const Silian_deltaRow = Silian_row - Silian_dragRow;
          const Silian_falloff = Math.exp(-((Silian_deltaColumn * Silian_deltaColumn) / 9 + (Silian_deltaRow * Silian_deltaRow) / 16));
          const Silian_offset = Silian_index * 3;
          Silian_positions[Silian_offset] += Silian_dragState.velocity.x * 0.12 * Silian_falloff;
          Silian_positions[Silian_offset + 1] += Silian_dragState.velocity.y * 0.08 * Silian_falloff;
          Silian_positions[Silian_offset + 2] += (Silian_dragState.velocity.z * 0.45 + Silian_deltaColumn * 0.003 - Silian_deltaRow * 0.004) * Silian_falloff;
        }
      }
    };

    const Silian_satisfyConstraints = () => {
      for (let Silian_iteration = 0; Silian_iteration < Silian_CONSTRAINT_ITERATIONS; Silian_iteration += 1) {
        Silian_enforceTopEdge();
        Silian_applyDragInfluence();

        for (let Silian_constraintIndex = 0; Silian_constraintIndex < Silian_constraints.length; Silian_constraintIndex += 1) {
          const Silian_constraint = Silian_constraints[Silian_constraintIndex];
          const Silian_offsetA = Silian_constraint.first * 3;
          const Silian_offsetB = Silian_constraint.second * 3;

          const Silian_dx = Silian_positions[Silian_offsetB] - Silian_positions[Silian_offsetA];
          const Silian_dy = Silian_positions[Silian_offsetB + 1] - Silian_positions[Silian_offsetA + 1];
          const Silian_dz = Silian_positions[Silian_offsetB + 2] - Silian_positions[Silian_offsetA + 2];
          const Silian_distance = Math.sqrt(Silian_dx * Silian_dx + Silian_dy * Silian_dy + Silian_dz * Silian_dz) || 1;
          const Silian_difference = (Silian_distance - Silian_constraint.restLength) / Silian_distance;

          const Silian_correctionX = Silian_dx * 0.5 * Silian_difference * Silian_constraint.stiffness;
          const Silian_correctionY = Silian_dy * 0.5 * Silian_difference * Silian_constraint.stiffness;
          const Silian_correctionZ = Silian_dz * 0.5 * Silian_difference * Silian_constraint.stiffness;

          if (!Silian_pinned[Silian_constraint.first]) {
            Silian_positions[Silian_offsetA] += Silian_correctionX;
            Silian_positions[Silian_offsetA + 1] += Silian_correctionY;
            Silian_positions[Silian_offsetA + 2] += Silian_correctionZ;
          }

          if (!Silian_pinned[Silian_constraint.second]) {
            Silian_positions[Silian_offsetB] -= Silian_correctionX;
            Silian_positions[Silian_offsetB + 1] -= Silian_correctionY;
            Silian_positions[Silian_offsetB + 2] -= Silian_correctionZ;
          }
        }
      }

      Silian_enforceTopEdge();
    };

    const Silian_stepSimulation = (Silian_stepTime, Silian_elapsedTime) => {
      const Silian_deltaSquared = Silian_stepTime * Silian_stepTime;

      for (let Silian_index = Silian_columnCount; Silian_index < Silian_particleCount; Silian_index += 1) {
        if (Silian_pinned[Silian_index]) {
          continue;
        }

        const Silian_offset = Silian_index * 3;
        const Silian_row = Math.floor(Silian_index / Silian_columnCount);
        const Silian_rowFactor = Silian_row / Silian_segmentsY;
        const Silian_x = Silian_positions[Silian_offset];
        const Silian_y = Silian_positions[Silian_offset + 1];
        const Silian_z = Silian_positions[Silian_offset + 2];

        const Silian_velocityX = (Silian_x - Silian_previousPositions[Silian_offset]) * 0.992;
        const Silian_velocityY = (Silian_y - Silian_previousPositions[Silian_offset + 1]) * 0.992;
        const Silian_velocityZ = (Silian_z - Silian_previousPositions[Silian_offset + 2]) * 0.988;

        Silian_previousPositions[Silian_offset] = Silian_x;
        Silian_previousPositions[Silian_offset + 1] = Silian_y;
        Silian_previousPositions[Silian_offset + 2] = Silian_z;

        const Silian_restX = Silian_restPositions[Silian_offset];
        const Silian_restZ = Silian_restPositions[Silian_offset + 2];
        const Silian_flutter =
          (Math.sin(Silian_elapsedTime * 1.75 + Silian_restX * 7.3 + Silian_rowFactor * 5.4)
            + Math.cos(Silian_elapsedTime * 0.92 - Silian_restX * 3.4 + Silian_rowFactor * 7.1))
          * 0.52;
        const Silian_memoryX = (Silian_restX - Silian_x) * (0.018 + Silian_rowFactor * 0.01);
        const Silian_memoryZ = (Silian_restZ - Silian_z) * (0.022 + Silian_rowFactor * 0.015);
        const Silian_gravity = -7.8;

        Silian_positions[Silian_offset] += Silian_velocityX + Silian_memoryX * Silian_deltaSquared * 18;
        Silian_positions[Silian_offset + 1] += Silian_velocityY + Silian_gravity * Silian_deltaSquared;
        Silian_positions[Silian_offset + 2] += Silian_velocityZ + (Silian_flutter * Silian_rowFactor * Silian_rowFactor + Silian_memoryZ * 24) * Silian_deltaSquared;
      }

      Silian_satisfyConstraints();
    };

    const Silian_updatePointerFromEvent = (Silian_event) => {
      const Silian_bounds = Silian_renderer.domElement.getBoundingClientRect();
      Silian_pointer.x = ((Silian_event.clientX - Silian_bounds.left) / Silian_bounds.width) * 2 - 1;
      Silian_pointer.y = -(((Silian_event.clientY - Silian_bounds.top) / Silian_bounds.height) * 2 - 1);
    };

    const Silian_releaseDrag = () => {
      Silian_dragState.active = false;
      Silian_dragState.index = -1;
      Silian_dragState.pointerId = null;
      Silian_renderer.domElement.style.cursor = 'grab';
    };

    const Silian_handlePointerDown = (Silian_event) => {
      if (Silian_event.pointerType === 'mouse' && Silian_event.button !== 0) {
        return;
      }

      Silian_updatePointerFromEvent(Silian_event);
      Silian_raycaster.setFromCamera(Silian_pointer, Silian_camera);
      const Silian_hits = Silian_raycaster.intersectObject(Silian_receiptMesh, false);

      if (!Silian_hits.length) {
        return;
      }

      const Silian_hit = Silian_hits[0];
      const Silian_uv = Silian_hit.uv || new Silian_Vector2(0.5, 0.5);
      const Silian_column = Math.round(Silian_clamp(Silian_uv.x, 0, 1) * Silian_segmentsX);
      const Silian_row = Math.max(1, Math.round((1 - Silian_clamp(Silian_uv.y, 0, 1)) * Silian_segmentsY));
      const Silian_index = Silian_indexOf(Silian_column, Silian_row);

      Silian_camera.getWorldDirection(Silian_cameraDirection);
      Silian_dragPlane.setFromNormalAndCoplanarPoint(Silian_cameraDirection, Silian_hit.point);

      Silian_dragState.active = true;
      Silian_dragState.index = Silian_index;
      Silian_dragState.pointerId = Silian_event.pointerId;
      Silian_dragState.startPoint.copy(Silian_hit.point);
      Silian_dragState.target.copy(Silian_hit.point);
      Silian_dragState.lastTarget.copy(Silian_hit.point);
      Silian_dragState.velocity.set(0, 0, 0);

      Silian_renderer.domElement.style.cursor = 'grabbing';
      Silian_renderer.domElement.setPointerCapture?.(Silian_event.pointerId);
      Silian_event.preventDefault();
    };

    const Silian_handlePointerMove = (Silian_event) => {
      Silian_updatePointerFromEvent(Silian_event);
      Silian_raycaster.setFromCamera(Silian_pointer, Silian_camera);

      if (Silian_dragState.active) {
        if (Silian_dragState.pointerId !== null && Silian_event.pointerId !== Silian_dragState.pointerId) {
          return;
        }

        if (Silian_raycaster.ray.intersectPlane(Silian_dragPlane, Silian_intersectionPoint)) {
          Silian_tempVector.copy(Silian_intersectionPoint).sub(Silian_dragState.startPoint);
          if (Silian_tempVector.length() > Silian_MAX_DRAG_DISTANCE) {
            Silian_tempVector.setLength(Silian_MAX_DRAG_DISTANCE);
          }

          const Silian_nextTarget = Silian_dragState.startPoint.clone().add(Silian_tempVector);
          Silian_dragState.velocity.copy(Silian_nextTarget).sub(Silian_dragState.target);
          Silian_dragState.lastTarget.copy(Silian_dragState.target);
          Silian_dragState.target.copy(Silian_nextTarget);
        }
        return;
      }

      const Silian_hits = Silian_raycaster.intersectObject(Silian_receiptMesh, false);
      Silian_renderer.domElement.style.cursor = Silian_hits.length ? 'grab' : 'default';
    };

    const Silian_handlePointerUp = (Silian_event) => {
      if (Silian_dragState.pointerId !== null && Silian_event.pointerId !== Silian_dragState.pointerId) {
        return;
      }
      Silian_releaseDrag();
    };

    const Silian_handlePointerLeave = () => {
      if (!Silian_dragState.active) {
        Silian_renderer.domElement.style.cursor = 'default';
      }
    };

    const Silian_resize = () => {
      const Silian_width = Math.max(Silian_container.clientWidth, 1);
      const Silian_height = Math.max(Silian_container.clientHeight, 1);
      Silian_renderer.setSize(Silian_width, Silian_height, false);
      Silian_camera.aspect = Silian_width / Silian_height;
      Silian_camera.updateProjectionMatrix();
    };

    Silian_resizeObserver = new ResizeObserver(Silian_resize);
    Silian_resizeObserver.observe(Silian_container);
    Silian_resize();

    Silian_visibilityHandler = () => {
      Silian_documentHidden = document.hidden;
    };
    document.addEventListener('visibilitychange', Silian_visibilityHandler);

    Silian_renderer.domElement.addEventListener('pointerdown', Silian_handlePointerDown);
    Silian_renderer.domElement.addEventListener('pointermove', Silian_handlePointerMove);
    Silian_renderer.domElement.addEventListener('pointerup', Silian_handlePointerUp);
    Silian_renderer.domElement.addEventListener('pointercancel', Silian_handlePointerUp);
    Silian_renderer.domElement.addEventListener('pointerleave', Silian_handlePointerLeave);

    let Silian_lastTimestamp = performance.now();
    let Silian_accumulator = 0;

    const Silian_renderLoop = (Silian_timestamp) => {
      const Silian_elapsed = Silian_timestamp / 1000;
      const Silian_frameDelta = Silian_clamp((Silian_timestamp - Silian_lastTimestamp) / 1000, 0, Silian_MAX_FRAME_DELTA);
      Silian_lastTimestamp = Silian_timestamp;

      if (!Silian_documentHidden) {
        Silian_accumulator += Silian_frameDelta;
        while (Silian_accumulator >= Silian_SIMULATION_STEP) {
          Silian_stepSimulation(Silian_SIMULATION_STEP, Silian_elapsed);
          Silian_accumulator -= Silian_SIMULATION_STEP;
        }

        Silian_geometry.attributes.position.array.set(Silian_positions);
        Silian_geometry.attributes.position.needsUpdate = true;

        Silian_normalFrameCounter += 1;
        if (Silian_normalFrameCounter % 2 === 0) {
          Silian_geometry.computeVertexNormals();
        }

        Silian_renderer.render(Silian_scene, Silian_camera);
      }

      Silian_animationFrameId = window.requestAnimationFrame(Silian_renderLoop);
    };

    Silian_animationFrameId = window.requestAnimationFrame(Silian_renderLoop);

    return () => {
      window.cancelAnimationFrame(Silian_animationFrameId);
      Silian_resizeObserver?.disconnect();
      document.removeEventListener('visibilitychange', Silian_visibilityHandler);
      Silian_renderer.domElement.removeEventListener('pointerdown', Silian_handlePointerDown);
      Silian_renderer.domElement.removeEventListener('pointermove', Silian_handlePointerMove);
      Silian_renderer.domElement.removeEventListener('pointerup', Silian_handlePointerUp);
      Silian_renderer.domElement.removeEventListener('pointercancel', Silian_handlePointerUp);
      Silian_renderer.domElement.removeEventListener('pointerleave', Silian_handlePointerLeave);
      Silian_geometry.dispose();
      Silian_receiptTexture.dispose();
      Silian_receiptMaterial.dispose();
      Silian_backdrop.geometry.dispose();
      Silian_backdrop.material.dispose();
      Silian_anchorBar.geometry.dispose();
      Silian_anchorBar.material.dispose();
      Silian_renderer.dispose();
    };
  }, [Silian_isZh, Silian_summary, Silian_webglUnavailable]);

  if (Silian_webglUnavailable) {
    return <Silian_ReceiptFallback summary={Silian_summary} onRestart={Silian_onRestart} onGoDashboard={Silian_onGoDashboard} />;
  }

  return (
    <div className="overflow-hidden rounded-[36px] border border-black/6 bg-[#fcfcf9] text-slate-900 shadow-[0_32px_100px_-54px_rgba(15,23,42,0.45)]">
      <div className="mx-auto flex max-w-[1040px] flex-col gap-8 px-6 py-6 lg:px-10 lg:py-10">
        <div className="max-w-[640px] space-y-5">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/12 text-emerald-600">
            <Silian_CheckCircle2 className="h-6 w-6" />
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-emerald-600">
              {Silian_summary.successEyebrow}
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              {Silian_summary.successTitle}
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {Silian_summary.successDescription}
            </p>
          </div>
        </div>

        <div
          ref={Silian_motionCardRef}
          className="rounded-[30px] border border-slate-200 bg-white p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_24px_80px_-48px_rgba(15,23,42,0.42)]"
        >
          <div className="relative overflow-hidden rounded-[24px] bg-white">
            <div className="pointer-events-none absolute left-1/2 top-4 z-20 h-3 w-[42%] -translate-x-1/2 rounded-full bg-[#dfe5de] shadow-[inset_0_2px_6px_rgba(15,23,42,0.14)]" />
            <div ref={Silian_stageRef} className="h-[720px] w-full md:h-[820px]" />
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Silian_Button onClick={Silian_onRestart} className="bg-slate-950 text-white hover:bg-slate-800">
            <Silian_RotateCcw className="mr-2 h-4 w-4" />
            {Silian_summary.actions.restart}
          </Silian_Button>
          <Silian_Button
            variant="outline"
            onClick={Silian_onGoDashboard}
            className="border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
          >
            {Silian_summary.actions.dashboard}
          </Silian_Button>
        </div>
      </div>
    </div>
  );
}

export default InteractiveReceipt;
