import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ACESFilmicToneMapping,
  AmbientLight,
  BoxGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  DoubleSide,
  DynamicDrawUsage,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Plane,
  PlaneGeometry,
  PointLight,
  Raycaster,
  SRGBColorSpace,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import {
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { useTranslation } from '../../hooks/useTranslation';

const SIMULATION_STEP = 1 / 120;
const MAX_FRAME_DELTA = 1 / 24;
const CONSTRAINT_ITERATIONS = 6;
const RECEIPT_WIDTH = 1.16;
const RECEIPT_HEIGHT = 2.42;
const MAX_DRAG_DISTANCE = 1.4;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function safeNumber(value, fallback = 0) {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function formatNumber(value, locale, options = {}) {
  return new Intl.NumberFormat(locale, options).format(safeNumber(value));
}

function formatDate(value, locale, options = {}) {
  if (!value) {
    return '—';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat(locale, options).format(date);
}

function getActivityName(activity, isZh) {
  if (!activity) {
    return isZh ? '未命名活动' : 'Untitled activity';
  }

  return isZh
    ? (activity.name_zh || activity.name_en || activity.name || '未命名活动')
    : (activity.name_en || activity.name_zh || activity.name || 'Untitled activity');
}

function wrapText(ctx, text, maxWidth) {
  const content = String(text || '').trim();
  if (!content) {
    return [];
  }

  const paragraphs = content.split(/\r?\n/);
  const lines = [];

  paragraphs.forEach((paragraph) => {
    if (!paragraph.trim()) {
      lines.push('');
      return;
    }

    let line = '';
    for (const char of paragraph) {
      const nextLine = line + char;
      if (line && ctx.measureText(nextLine).width > maxWidth) {
        lines.push(line);
        line = char;
      } else {
        line = nextLine;
      }
    }

    if (line) {
      lines.push(line);
    }
  });

  return lines;
}

function drawReceiptTexture(data, isZh) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 2048;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return canvas;
  }

  const thermalWhite = '#fffdf5';
  const thermalShadow = '#ede7da';
  const ink = '#272623';
  const mutedInk = '#7c766a';
  const accent = '#0f8c53';

  ctx.fillStyle = thermalWhite;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.globalAlpha = 0.08;
  for (let i = 0; i < 3800; i += 1) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const width = Math.random() * 2 + 0.5;
    const height = Math.random() * 2 + 0.5;
    ctx.fillStyle = i % 7 === 0 ? '#d7cfbd' : '#cec7ba';
    ctx.fillRect(x, y, width, height);
  }

  ctx.globalAlpha = 0.06;
  for (let y = 0; y < canvas.height; y += 6) {
    ctx.fillStyle = y % 18 === 0 ? '#cfc8b8' : '#dbd4c5';
    ctx.fillRect(0, y, canvas.width, 1);
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = thermalShadow;
  ctx.fillRect(0, 36, canvas.width, 10);

  let cursorY = 92;
  const marginX = 76;
  const innerWidth = canvas.width - marginX * 2;

  ctx.fillStyle = accent;
  ctx.font = `700 ${isZh ? 58 : 60}px "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif`;
  ctx.fillText('CARBONTRACK', marginX, cursorY);

  ctx.fillStyle = mutedInk;
  ctx.font = `500 ${isZh ? 25 : 24}px "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif`;
  ctx.fillText(data.receiptTitle, marginX, cursorY + 66);
  ctx.fillText(`#${data.recordId}`, canvas.width - marginX - ctx.measureText(`#${data.recordId}`).width, cursorY + 66);

  cursorY += 128;

  ctx.strokeStyle = '#302f2a';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 8]);
  ctx.beginPath();
  ctx.moveTo(marginX, cursorY);
  ctx.lineTo(canvas.width - marginX, cursorY);
  ctx.stroke();
  ctx.setLineDash([]);

  cursorY += 34;

  const labelFont = `600 ${isZh ? 24 : 22}px "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif`;
  const valueFont = `500 ${isZh ? 29 : 28}px "Cascadia Mono", "SFMono-Regular", Consolas, monospace`;

  const drawPair = (label, value) => {
    ctx.fillStyle = mutedInk;
    ctx.font = labelFont;
    ctx.fillText(label, marginX, cursorY);

    ctx.fillStyle = ink;
    ctx.font = valueFont;
    const wrapped = wrapText(ctx, value, innerWidth);
    let localY = cursorY + 30;
    wrapped.forEach((line) => {
      ctx.fillText(line, marginX, localY);
      localY += 36;
    });

    cursorY = localY + 18;
  };

  drawPair(data.activityLabel, data.activityName);
  drawPair(data.categoryLabel, data.categoryName);
  drawPair(data.amountLabel, data.amountLine);
  drawPair(data.factorLabel, data.factorLine);
  drawPair(data.activityDateLabel, data.activityDate);

  if (data.checkinDate) {
    drawPair(data.checkinLabel, data.checkinDate);
  }

  drawPair(data.submittedAtLabel, data.submittedAt);
  drawPair(data.imageCountLabel, data.imageCount);

  ctx.fillStyle = '#1e1d1a';
  ctx.fillRect(marginX, cursorY + 10, innerWidth, 3);
  cursorY += 46;

  ctx.fillStyle = mutedInk;
  ctx.font = labelFont;
  ctx.fillText(data.formulaLabel, marginX, cursorY);

  cursorY += 34;
  ctx.fillStyle = ink;
  ctx.font = `700 ${isZh ? 38 : 36}px "Cascadia Mono", "SFMono-Regular", Consolas, monospace`;
  wrapText(ctx, data.formulaLine, innerWidth).forEach((line) => {
    ctx.fillText(line, marginX, cursorY);
    cursorY += 48;
  });

  cursorY += 14;

  ctx.strokeStyle = '#302f2a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(marginX, cursorY);
  ctx.lineTo(canvas.width - marginX, cursorY);
  ctx.stroke();

  cursorY += 34;

  ctx.fillStyle = mutedInk;
  ctx.font = labelFont;
  ctx.fillText(data.descriptionLabel, marginX, cursorY);
  cursorY += 30;

  ctx.fillStyle = ink;
  ctx.font = `500 ${isZh ? 28 : 26}px "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif`;
  wrapText(ctx, data.descriptionValue, innerWidth).slice(0, 6).forEach((line) => {
    ctx.fillText(line || ' ', marginX, cursorY);
    cursorY += 38;
  });

  cursorY += 12;
  ctx.fillStyle = thermalShadow;
  ctx.fillRect(marginX, cursorY, innerWidth, 1);
  cursorY += 34;

  ctx.fillStyle = mutedInk;
  ctx.font = `500 ${isZh ? 22 : 20}px "Cascadia Mono", "SFMono-Regular", Consolas, monospace`;
  ctx.fillText(data.footerLineOne, marginX, cursorY);
  cursorY += 30;
  ctx.fillText(data.footerLineTwo, marginX, cursorY);

  return canvas;
}

function ReceiptFallback({ summary, onRestart, onGoDashboard }) {
  return (
    <div className="overflow-hidden rounded-[36px] border border-black/6 bg-[#fcfcf9] text-slate-900 shadow-[0_32px_100px_-54px_rgba(15,23,42,0.45)]">
      <div className="mx-auto flex max-w-[1040px] flex-col gap-8 px-6 py-6 lg:px-10 lg:py-10">
        <div className="max-w-[640px] space-y-5">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/12 text-emerald-600">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-emerald-600">
              {summary.successEyebrow}
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              {summary.successTitle}
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {summary.successDescription}
            </p>
          </div>
        </div>

        <div className="rounded-[30px] border border-[#ece7da] bg-[#fffdf5] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_20px_60px_-40px_rgba(15,23,42,0.35)]">
          <div className="mx-auto max-w-[440px] font-mono text-[13px] text-[#25231f]">
            <div className="border-b border-dashed border-[#2c2a26] pb-4">
              <p className="text-lg font-bold tracking-[0.26em] text-emerald-600">CARBONTRACK</p>
              <p className="mt-2 text-[#716b61]">{summary.receiptTitle}</p>
            </div>
            <div className="space-y-4 py-4">
              {summary.printLines.map((line) => (
                <div key={line.label}>
                  <p className="text-[#716b61]">{line.label}</p>
                  <p className="mt-1 text-[15px] font-semibold">{line.value}</p>
                </div>
              ))}
            </div>
            <div className="border-t border-b border-[#2c2a26] py-4">
              <p className="text-[#716b61]">{summary.formulaLabel}</p>
              <p className="mt-2 text-[16px] font-bold">{summary.formulaLine}</p>
            </div>
            <div className="space-y-3 py-4">
              <div>
                <p className="text-[#716b61]">{summary.descriptionLabel}</p>
                <p className="mt-1 text-[15px] leading-6">{summary.descriptionValue}</p>
              </div>
              <div className="border-t border-[#d9d2c5] pt-3 text-[#716b61]">
                <p>{summary.footerLineOne}</p>
                <p className="mt-2">{summary.footerLineTwo}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button onClick={onRestart} className="bg-slate-950 text-white hover:bg-slate-800">
            {summary.actions.restart}
          </Button>
          <Button
            variant="outline"
            onClick={onGoDashboard}
            className="border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
          >
            {summary.actions.dashboard}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function InteractiveReceipt({ receipt, onRestart, onGoDashboard }) {
  const { t, currentLanguage } = useTranslation(['activities', 'date', 'images', 'units']);
  const stageRef = useRef(null);
  const motionCardRef = useRef(null);
  const [webglUnavailable, setWebglUnavailable] = useState(false);

  const locale = currentLanguage?.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US';
  const isZh = locale === 'zh-CN';

  const summary = useMemo(() => {
    const amount = safeNumber(receipt?.amount);
    const factor = safeNumber(receipt?.activity?.carbon_factor);
    const carbonSaved = safeNumber(receipt?.carbon_saved);
    const imageCount = Array.isArray(receipt?.images) ? receipt.images.length : safeNumber(receipt?.image_count);
    const activityName = getActivityName(receipt?.activity, isZh);
    const categoryName = t(`activities.categories.${receipt?.activity?.category}`, {
      defaultValue: receipt?.activity?.category || (isZh ? '未分类' : 'Uncategorized'),
    });
    const unitName = t(`units.${receipt?.activity?.unit}`, {
      defaultValue: receipt?.activity?.unit || (isZh ? '单位' : 'unit'),
    });
    const factorLine = `${formatNumber(factor, locale, {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    })} kg CO₂ / ${unitName}`;
    const amountLine = `${formatNumber(amount, locale, {
      minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    })} ${unitName}`;
    const formulaLine = `${formatNumber(amount, locale, {
      minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    })} ${unitName} × ${formatNumber(factor, locale, {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    })} = ${formatNumber(carbonSaved, locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} kg CO₂`;
    const activityDate = formatDate(receipt?.date, locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const checkinDate = receipt?.checkin_date
      ? formatDate(receipt.checkin_date, locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
      : '';
    const submittedAt = formatDate(receipt?.submitted_at, locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    const descriptionValue = String(receipt?.description || '').trim()
      || (isZh ? '无附加备注。' : 'No extra note.');

    return {
      successEyebrow: 'THERMAL RECEIPT',
      successTitle: t('activities.form.submitSuccess', {
        defaultValue: isZh ? '记录提交成功' : 'Submission complete',
      }),
      successDescription: isZh
        ? '核算详情已生成热敏小票，你可以直接查看完整记录。'
        : 'The calculation details are now printed on a thermal-style receipt for direct review.',
      receiptTitle: isZh ? '减碳核算回执' : 'Carbon Reduction Receipt',
      recordId: receipt?.record_id ?? '—',
      activityLabel: isZh ? '活动项目' : 'Activity',
      activityName,
      categoryLabel: isZh ? '分类' : 'Category',
      categoryName,
      amountLabel: isZh ? '提交数值' : 'Submitted amount',
      amountLine,
      factorLabel: isZh ? '减排系数' : 'Carbon factor',
      factorLine,
      activityDateLabel: isZh ? '活动日期' : 'Activity date',
      activityDate,
      checkinLabel: isZh ? '补签日期' : 'Check-in date',
      checkinDate,
      submittedAtLabel: isZh ? '提交时间' : 'Submitted at',
      submittedAt,
      imageCountLabel: isZh ? '凭证张数' : 'Proof images',
      imageCount: isZh ? `${imageCount} 张` : `${imageCount} files`,
      formulaLabel: isZh ? '核算公式' : 'Calculation formula',
      formulaLine,
      descriptionLabel: isZh ? '备注 / 审核提示' : 'Notes / review memo',
      descriptionValue,
      footerLineOne: isZh
        ? '此回执已进入人工审核队列，请保留凭证。'
        : 'This receipt is queued for manual review. Keep your proof ready.',
      footerLineTwo: 'CarbonTrack · thermal log snapshot',
      actions: {
        restart: t('activities.form.recordAnother', {
          defaultValue: isZh ? '继续记录下一条' : 'Record another',
        }),
        dashboard: t('activities.form.goToDashboard', {
          defaultValue: isZh ? '返回仪表盘' : 'Go to dashboard',
        }),
      },
      printLines: [
        { label: isZh ? '活动项目' : 'Activity', value: activityName },
        { label: isZh ? '分类' : 'Category', value: categoryName },
        { label: isZh ? '提交数值' : 'Submitted amount', value: amountLine },
        { label: isZh ? '减排系数' : 'Carbon factor', value: factorLine },
        { label: isZh ? '活动日期' : 'Activity date', value: activityDate },
      ],
    };
  }, [isZh, locale, receipt, t]);

  useEffect(() => {
    const motionCard = motionCardRef.current;
    if (!motionCard || typeof window === 'undefined') {
      return undefined;
    }

    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const isCoarsePointer = window.matchMedia?.('(pointer: coarse)').matches;

    if (prefersReducedMotion || !isCoarsePointer) {
      motionCard.style.transform = '';
      return undefined;
    }

    let animationFrameId = 0;
    let listening = false;
    const current = { x: 0, y: 0, rotateX: 0, rotateY: 0 };
    const target = { x: 0, y: 0, rotateX: 0, rotateY: 0 };

    const applyTransform = () => {
      current.x += (target.x - current.x) * 0.12;
      current.y += (target.y - current.y) * 0.12;
      current.rotateX += (target.rotateX - current.rotateX) * 0.12;
      current.rotateY += (target.rotateY - current.rotateY) * 0.12;

      motionCard.style.transform = `perspective(1400px) translate3d(${current.x.toFixed(2)}px, ${current.y.toFixed(2)}px, 0) rotateX(${current.rotateX.toFixed(2)}deg) rotateY(${current.rotateY.toFixed(2)}deg)`;
      animationFrameId = window.requestAnimationFrame(applyTransform);
    };

    const handleOrientation = (event) => {
      const gamma = clamp(safeNumber(event.gamma), -18, 18);
      const beta = clamp(safeNumber(event.beta) - 28, -20, 20);

      target.x = gamma * 0.7;
      target.y = beta * -0.55;
      target.rotateX = beta * -0.18;
      target.rotateY = gamma * 0.24;
    };

    const startListening = () => {
      if (listening) {
        return;
      }

      window.addEventListener('deviceorientation', handleOrientation, true);
      listening = true;
    };

    const requestOrientationAccess = async () => {
      try {
        if (
          typeof DeviceOrientationEvent !== 'undefined'
          && typeof DeviceOrientationEvent.requestPermission === 'function'
        ) {
          const permission = await DeviceOrientationEvent.requestPermission();
          if (permission === 'granted') {
            startListening();
          }
          return;
        }

        startListening();
      } catch (error) {
        console.error('Unable to enable device orientation for receipt card', error);
      }
    };

    const handleGesture = () => {
      requestOrientationAccess();
    };

    motionCard.style.willChange = 'transform';
    animationFrameId = window.requestAnimationFrame(applyTransform);
    window.addEventListener('touchstart', handleGesture, { passive: true });
    window.addEventListener('pointerdown', handleGesture, { passive: true });

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener('touchstart', handleGesture);
      window.removeEventListener('pointerdown', handleGesture);
      if (listening) {
        window.removeEventListener('deviceorientation', handleOrientation, true);
      }
      motionCard.style.willChange = '';
      motionCard.style.transform = '';
    };
  }, []);

  useEffect(() => {
    const container = stageRef.current;
    if (!container || webglUnavailable) {
      return undefined;
    }

    let animationFrameId = 0;
    let resizeObserver;
    let visibilityHandler;
    let renderer;

    try {
      renderer = new WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      });
    } catch (error) {
      console.error('Unable to create WebGL renderer for receipt scene', error);
      setWebglUnavailable(true);
      return undefined;
    }

    const scene = new Scene();
    const camera = new PerspectiveCamera(30, 1, 0.1, 20);
    camera.position.set(0, 0.08, 4.55);
    camera.lookAt(0, 0.03, 0);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setClearColor('#ffffff', 1);
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFSoftShadowMap;
    renderer.domElement.className = 'h-full w-full touch-none select-none';
    renderer.domElement.style.cursor = 'grab';
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const ambientLight = new AmbientLight(0xffffff, 1.3);
    scene.add(ambientLight);

    const keyLight = new DirectionalLight(0xffffff, 1.5);
    keyLight.position.set(1.8, 2.4, 3.1);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 10;
    keyLight.shadow.camera.left = -3;
    keyLight.shadow.camera.right = 3;
    keyLight.shadow.camera.top = 3;
    keyLight.shadow.camera.bottom = -3;
    keyLight.shadow.bias = -0.0002;
    scene.add(keyLight);

    const fillLight = new DirectionalLight(0xeef6ff, 0.5);
    fillLight.position.set(-2.2, 0.8, 1.4);
    scene.add(fillLight);

    const warmLight = new PointLight(0xfff2cf, 0.35, 6, 2);
    warmLight.position.set(0.4, -1.25, 1.1);
    scene.add(warmLight);

    const backdrop = new Mesh(
      new PlaneGeometry(6.4, 6.4),
      new MeshStandardMaterial({
        color: '#ffffff',
        roughness: 1,
        metalness: 0,
      }),
    );
    backdrop.position.set(0, -0.04, -1.05);
    backdrop.receiveShadow = true;
    scene.add(backdrop);

    const textureCanvas = drawReceiptTexture(summary, isZh);
    const receiptTexture = new CanvasTexture(textureCanvas);
    receiptTexture.colorSpace = SRGBColorSpace;
    receiptTexture.anisotropy = renderer.capabilities.getMaxAnisotropy
      ? Math.min(4, renderer.capabilities.getMaxAnisotropy())
      : 1;

    const segmentsX = container.clientWidth >= 960 ? 30 : 24;
    const segmentsY = container.clientWidth >= 960 ? 56 : 48;
    const columnCount = segmentsX + 1;
    const rowCount = segmentsY + 1;
    const particleCount = columnCount * rowCount;
    const positions = new Float32Array(particleCount * 3);
    const previousPositions = new Float32Array(particleCount * 3);
    const restPositions = new Float32Array(particleCount * 3);
    const topAnchors = new Float32Array(columnCount * 3);
    const pinned = new Uint8Array(particleCount);
    const constraints = [];

    const indexOf = (column, row) => row * columnCount + column;

    const setVector = (array, index, x, y, z) => {
      const offset = index * 3;
      array[offset] = x;
      array[offset + 1] = y;
      array[offset + 2] = z;
    };

    const getDistance = (array, first, second) => {
      const offsetA = first * 3;
      const offsetB = second * 3;
      const dx = array[offsetA] - array[offsetB];
      const dy = array[offsetA + 1] - array[offsetB + 1];
      const dz = array[offsetA + 2] - array[offsetB + 2];
      return Math.sqrt(dx * dx + dy * dy + dz * dz);
    };

    const addConstraint = (first, second, stiffness) => {
      constraints.push({
        first,
        second,
        restLength: getDistance(restPositions, first, second),
        stiffness,
      });
    };

    for (let row = 0; row < rowCount; row += 1) {
      const v = row / segmentsY;
      for (let column = 0; column < columnCount; column += 1) {
        const u = column / segmentsX;
        const x = (u - 0.5) * RECEIPT_WIDTH;
        const y = RECEIPT_HEIGHT * 0.5 - v * RECEIPT_HEIGHT;
        const wrinkle = Math.sin(u * Math.PI * 4.3 + v * 5.6) * 0.014 * Math.pow(v, 1.45);
        const curl = Math.pow(v, 2.1) * 0.12;
        const creaseNoise = Math.cos(u * 17.4 - v * 12.7) * 0.006 * Math.pow(v, 1.65);
        const z = row === 0 ? 0 : curl + wrinkle + creaseNoise;
        const index = indexOf(column, row);

        setVector(positions, index, x, y, z);
        setVector(previousPositions, index, x, y, z);
        setVector(restPositions, index, x, y, z);

        if (row === 0) {
          pinned[index] = 1;
          setVector(topAnchors, column, x, y, 0);
        }
      }
    }

    for (let row = 0; row < rowCount; row += 1) {
      for (let column = 0; column < columnCount; column += 1) {
        const current = indexOf(column, row);
        const topBand = 1 - clamp(row / Math.max(1, segmentsY * 0.18), 0, 1);
        const structuralBoost = topBand * 0.16;
        const bendBoost = topBand * 0.12;

        if (column < segmentsX) {
          addConstraint(current, indexOf(column + 1, row), 0.82 + structuralBoost);
        }
        if (row < segmentsY) {
          addConstraint(current, indexOf(column, row + 1), 0.88 + structuralBoost);
        }
        if (column < segmentsX && row < segmentsY) {
          addConstraint(current, indexOf(column + 1, row + 1), 0.2 + topBand * 0.08);
          addConstraint(indexOf(column + 1, row), indexOf(column, row + 1), 0.2 + topBand * 0.08);
        }
        if (column < segmentsX - 1) {
          addConstraint(current, indexOf(column + 2, row), 0.12 + bendBoost);
        }
        if (row < segmentsY - 1) {
          addConstraint(current, indexOf(column, row + 2), 0.16 + bendBoost);
        }
      }
    }

    const geometry = new PlaneGeometry(RECEIPT_WIDTH, RECEIPT_HEIGHT, segmentsX, segmentsY);
    geometry.attributes.position.setUsage(DynamicDrawUsage);
    geometry.attributes.position.array.set(positions);
    geometry.computeVertexNormals();

    const receiptMaterial = new MeshPhysicalMaterial({
      color: '#fffdf7',
      map: receiptTexture,
      roughness: 0.96,
      metalness: 0,
      clearcoat: 0.06,
      clearcoatRoughness: 0.9,
      sheen: 0.22,
      sheenRoughness: 0.88,
      sheenColor: new Color('#fff9e6'),
      side: DoubleSide,
    });

    const receiptMesh = new Mesh(geometry, receiptMaterial);
    receiptMesh.position.set(0, -0.06, 0.03);
    receiptMesh.rotation.x = -0.06;
    receiptMesh.castShadow = true;
    receiptMesh.receiveShadow = true;
    scene.add(receiptMesh);

    const anchorBar = new Mesh(
      new BoxGeometry(RECEIPT_WIDTH + 0.18, 0.028, 0.12),
      new MeshStandardMaterial({
        color: '#e2e7df',
        roughness: 0.82,
        metalness: 0.08,
      }),
    );
    anchorBar.position.set(0, receiptMesh.position.y + RECEIPT_HEIGHT * 0.5 + 0.015, -0.08);
    anchorBar.castShadow = true;
    anchorBar.receiveShadow = true;
    scene.add(anchorBar);

    const raycaster = new Raycaster();
    const pointer = new Vector2();
    const dragPlane = new Plane();
    const intersectionPoint = new Vector3();
    const tempVector = new Vector3();
    const cameraDirection = new Vector3();
    const dragState = {
      active: false,
      index: -1,
      pointerId: null,
      startPoint: new Vector3(),
      target: new Vector3(),
      lastTarget: new Vector3(),
      velocity: new Vector3(),
    };

    let documentHidden = false;
    let normalFrameCounter = 0;

    const enforceTopEdge = () => {
      for (let column = 0; column < columnCount; column += 1) {
        const particleOffset = column * 3;
        const anchorOffset = column * 3;
        positions[particleOffset] = topAnchors[anchorOffset];
        positions[particleOffset + 1] = topAnchors[anchorOffset + 1];
        positions[particleOffset + 2] = topAnchors[anchorOffset + 2];
        previousPositions[particleOffset] = topAnchors[anchorOffset];
        previousPositions[particleOffset + 1] = topAnchors[anchorOffset + 1];
        previousPositions[particleOffset + 2] = topAnchors[anchorOffset + 2];
      }
    };

    const applyDragInfluence = () => {
      if (!dragState.active || dragState.index < 0) {
        return;
      }

      const mainOffset = dragState.index * 3;
      positions[mainOffset] += (dragState.target.x - positions[mainOffset]) * 0.85;
      positions[mainOffset + 1] += (dragState.target.y - positions[mainOffset + 1]) * 0.85;
      positions[mainOffset + 2] += (dragState.target.z - positions[mainOffset + 2]) * 0.92;

      const dragColumn = dragState.index % columnCount;
      const dragRow = Math.floor(dragState.index / columnCount);

      for (let row = Math.max(1, dragRow - 4); row <= Math.min(segmentsY, dragRow + 5); row += 1) {
        for (let column = Math.max(0, dragColumn - 4); column <= Math.min(segmentsX, dragColumn + 4); column += 1) {
          const index = indexOf(column, row);
          if (index === dragState.index || pinned[index]) {
            continue;
          }

          const deltaColumn = column - dragColumn;
          const deltaRow = row - dragRow;
          const falloff = Math.exp(-((deltaColumn * deltaColumn) / 9 + (deltaRow * deltaRow) / 16));
          const offset = index * 3;
          positions[offset] += dragState.velocity.x * 0.12 * falloff;
          positions[offset + 1] += dragState.velocity.y * 0.08 * falloff;
          positions[offset + 2] += (dragState.velocity.z * 0.45 + deltaColumn * 0.003 - deltaRow * 0.004) * falloff;
        }
      }
    };

    const satisfyConstraints = () => {
      for (let iteration = 0; iteration < CONSTRAINT_ITERATIONS; iteration += 1) {
        enforceTopEdge();
        applyDragInfluence();

        for (let constraintIndex = 0; constraintIndex < constraints.length; constraintIndex += 1) {
          const constraint = constraints[constraintIndex];
          const offsetA = constraint.first * 3;
          const offsetB = constraint.second * 3;

          const dx = positions[offsetB] - positions[offsetA];
          const dy = positions[offsetB + 1] - positions[offsetA + 1];
          const dz = positions[offsetB + 2] - positions[offsetA + 2];
          const distance = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
          const difference = (distance - constraint.restLength) / distance;

          const correctionX = dx * 0.5 * difference * constraint.stiffness;
          const correctionY = dy * 0.5 * difference * constraint.stiffness;
          const correctionZ = dz * 0.5 * difference * constraint.stiffness;

          if (!pinned[constraint.first]) {
            positions[offsetA] += correctionX;
            positions[offsetA + 1] += correctionY;
            positions[offsetA + 2] += correctionZ;
          }

          if (!pinned[constraint.second]) {
            positions[offsetB] -= correctionX;
            positions[offsetB + 1] -= correctionY;
            positions[offsetB + 2] -= correctionZ;
          }
        }
      }

      enforceTopEdge();
    };

    const stepSimulation = (stepTime, elapsedTime) => {
      const deltaSquared = stepTime * stepTime;

      for (let index = columnCount; index < particleCount; index += 1) {
        if (pinned[index]) {
          continue;
        }

        const offset = index * 3;
        const row = Math.floor(index / columnCount);
        const rowFactor = row / segmentsY;
        const x = positions[offset];
        const y = positions[offset + 1];
        const z = positions[offset + 2];

        const velocityX = (x - previousPositions[offset]) * 0.992;
        const velocityY = (y - previousPositions[offset + 1]) * 0.992;
        const velocityZ = (z - previousPositions[offset + 2]) * 0.988;

        previousPositions[offset] = x;
        previousPositions[offset + 1] = y;
        previousPositions[offset + 2] = z;

        const restX = restPositions[offset];
        const restZ = restPositions[offset + 2];
        const flutter =
          (Math.sin(elapsedTime * 1.75 + restX * 7.3 + rowFactor * 5.4)
            + Math.cos(elapsedTime * 0.92 - restX * 3.4 + rowFactor * 7.1))
          * 0.52;
        const memoryX = (restX - x) * (0.018 + rowFactor * 0.01);
        const memoryZ = (restZ - z) * (0.022 + rowFactor * 0.015);
        const gravity = -7.8;

        positions[offset] += velocityX + memoryX * deltaSquared * 18;
        positions[offset + 1] += velocityY + gravity * deltaSquared;
        positions[offset + 2] += velocityZ + (flutter * rowFactor * rowFactor + memoryZ * 24) * deltaSquared;
      }

      satisfyConstraints();
    };

    const updatePointerFromEvent = (event) => {
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      pointer.y = -(((event.clientY - bounds.top) / bounds.height) * 2 - 1);
    };

    const releaseDrag = () => {
      dragState.active = false;
      dragState.index = -1;
      dragState.pointerId = null;
      renderer.domElement.style.cursor = 'grab';
    };

    const handlePointerDown = (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) {
        return;
      }

      updatePointerFromEvent(event);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObject(receiptMesh, false);

      if (!hits.length) {
        return;
      }

      const hit = hits[0];
      const uv = hit.uv || new Vector2(0.5, 0.5);
      const column = Math.round(clamp(uv.x, 0, 1) * segmentsX);
      const row = Math.max(1, Math.round((1 - clamp(uv.y, 0, 1)) * segmentsY));
      const index = indexOf(column, row);

      camera.getWorldDirection(cameraDirection);
      dragPlane.setFromNormalAndCoplanarPoint(cameraDirection, hit.point);

      dragState.active = true;
      dragState.index = index;
      dragState.pointerId = event.pointerId;
      dragState.startPoint.copy(hit.point);
      dragState.target.copy(hit.point);
      dragState.lastTarget.copy(hit.point);
      dragState.velocity.set(0, 0, 0);

      renderer.domElement.style.cursor = 'grabbing';
      renderer.domElement.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    };

    const handlePointerMove = (event) => {
      updatePointerFromEvent(event);
      raycaster.setFromCamera(pointer, camera);

      if (dragState.active) {
        if (dragState.pointerId !== null && event.pointerId !== dragState.pointerId) {
          return;
        }

        if (raycaster.ray.intersectPlane(dragPlane, intersectionPoint)) {
          tempVector.copy(intersectionPoint).sub(dragState.startPoint);
          if (tempVector.length() > MAX_DRAG_DISTANCE) {
            tempVector.setLength(MAX_DRAG_DISTANCE);
          }

          const nextTarget = dragState.startPoint.clone().add(tempVector);
          dragState.velocity.copy(nextTarget).sub(dragState.target);
          dragState.lastTarget.copy(dragState.target);
          dragState.target.copy(nextTarget);
        }
        return;
      }

      const hits = raycaster.intersectObject(receiptMesh, false);
      renderer.domElement.style.cursor = hits.length ? 'grab' : 'default';
    };

    const handlePointerUp = (event) => {
      if (dragState.pointerId !== null && event.pointerId !== dragState.pointerId) {
        return;
      }
      releaseDrag();
    };

    const handlePointerLeave = () => {
      if (!dragState.active) {
        renderer.domElement.style.cursor = 'default';
      }
    };

    const resize = () => {
      const width = Math.max(container.clientWidth, 1);
      const height = Math.max(container.clientHeight, 1);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resize();

    visibilityHandler = () => {
      documentHidden = document.hidden;
    };
    document.addEventListener('visibilitychange', visibilityHandler);

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointermove', handlePointerMove);
    renderer.domElement.addEventListener('pointerup', handlePointerUp);
    renderer.domElement.addEventListener('pointercancel', handlePointerUp);
    renderer.domElement.addEventListener('pointerleave', handlePointerLeave);

    let lastTimestamp = performance.now();
    let accumulator = 0;

    const renderLoop = (timestamp) => {
      const elapsed = timestamp / 1000;
      const frameDelta = clamp((timestamp - lastTimestamp) / 1000, 0, MAX_FRAME_DELTA);
      lastTimestamp = timestamp;

      if (!documentHidden) {
        accumulator += frameDelta;
        while (accumulator >= SIMULATION_STEP) {
          stepSimulation(SIMULATION_STEP, elapsed);
          accumulator -= SIMULATION_STEP;
        }

        geometry.attributes.position.array.set(positions);
        geometry.attributes.position.needsUpdate = true;

        normalFrameCounter += 1;
        if (normalFrameCounter % 2 === 0) {
          geometry.computeVertexNormals();
        }

        renderer.render(scene, camera);
      }

      animationFrameId = window.requestAnimationFrame(renderLoop);
    };

    animationFrameId = window.requestAnimationFrame(renderLoop);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      resizeObserver?.disconnect();
      document.removeEventListener('visibilitychange', visibilityHandler);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('pointerup', handlePointerUp);
      renderer.domElement.removeEventListener('pointercancel', handlePointerUp);
      renderer.domElement.removeEventListener('pointerleave', handlePointerLeave);
      geometry.dispose();
      receiptTexture.dispose();
      receiptMaterial.dispose();
      backdrop.geometry.dispose();
      backdrop.material.dispose();
      anchorBar.geometry.dispose();
      anchorBar.material.dispose();
      renderer.dispose();
    };
  }, [isZh, summary, webglUnavailable]);

  if (webglUnavailable) {
    return <ReceiptFallback summary={summary} onRestart={onRestart} onGoDashboard={onGoDashboard} />;
  }

  return (
    <div className="overflow-hidden rounded-[36px] border border-black/6 bg-[#fcfcf9] text-slate-900 shadow-[0_32px_100px_-54px_rgba(15,23,42,0.45)]">
      <div className="mx-auto flex max-w-[1040px] flex-col gap-8 px-6 py-6 lg:px-10 lg:py-10">
        <div className="max-w-[640px] space-y-5">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/12 text-emerald-600">
            <CheckCircle2 className="h-6 w-6" />
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-emerald-600">
              {summary.successEyebrow}
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              {summary.successTitle}
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {summary.successDescription}
            </p>
          </div>
        </div>

        <div
          ref={motionCardRef}
          className="rounded-[30px] border border-slate-200 bg-white p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_24px_80px_-48px_rgba(15,23,42,0.42)]"
        >
          <div className="relative overflow-hidden rounded-[24px] bg-white">
            <div className="pointer-events-none absolute left-1/2 top-4 z-20 h-3 w-[42%] -translate-x-1/2 rounded-full bg-[#dfe5de] shadow-[inset_0_2px_6px_rgba(15,23,42,0.14)]" />
            <div ref={stageRef} className="h-[720px] w-full md:h-[820px]" />
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button onClick={onRestart} className="bg-slate-950 text-white hover:bg-slate-800">
            <RotateCcw className="mr-2 h-4 w-4" />
            {summary.actions.restart}
          </Button>
          <Button
            variant="outline"
            onClick={onGoDashboard}
            className="border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
          >
            {summary.actions.dashboard}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default InteractiveReceipt;
