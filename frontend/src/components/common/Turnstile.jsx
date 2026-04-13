import React, { useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react';

// Cloudflare Turnstile 小部件
// 使用方式：
// <Turnstile onVerify={(token) => setValue('turnstile_token', token)} ref={turnstileRef} />
// 可通过 ref.current.reset() 重置

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

function loadTurnstileScript() {
	return new Promise((resolve, reject) => {
		if (window.turnstile) {
			resolve(window.turnstile);
			return;
		}
		const existing = document.querySelector('script[data-turnstile]');
		if (existing) {
			existing.addEventListener('load', () => resolve(window.turnstile));
			existing.addEventListener('error', reject);
			return;
		}
		const script = document.createElement('script');
		script.src = SCRIPT_SRC;
		script.async = true;
		script.defer = true;
		script.setAttribute('data-turnstile', 'true');
		script.onload = () => resolve(window.turnstile);
		script.onerror = reject;
		document.head.appendChild(script);
	});
}

const DEFAULT_TEST_SITEKEY = '1x00000000000000000000AA'; // Cloudflare 官方测试 site key

const Turnstile = forwardRef(function Turnstile(
	{
		siteKey = import.meta.env?.VITE_TURNSTILE_SITE_KEY || '',
		theme = 'auto',
		size = 'normal',
		action,
		cdata,
		tabindex = 0,
		className = '',
		onVerify,
		onExpire,
		onError,
		onLoad,
		require = false // 若为 true 且配置了 siteKey，则可在外层依据 token 判定按钮可用
	},
	ref
) {
	const containerRef = useRef(null);
	const widgetIdRef = useRef(null);
	const [loaded, setLoaded] = useState(false);
	const [token, setToken] = useState('');

	const resolvedSiteKey = siteKey || (import.meta.env?.MODE !== 'production' ? DEFAULT_TEST_SITEKEY : '');
	const siteKeyMissing = !resolvedSiteKey;

	useEffect(() => {
		let removed = false;
		if (siteKeyMissing) return; // 未配置 siteKey 时不加载脚本

		loadTurnstileScript()
			.then(() => {
				if (removed) return;
				setLoaded(true);
				if (typeof onLoad === 'function') onLoad();
				renderWidget();
			})
			.catch((err) => {
				console.error('Failed to load Turnstile script:', err);
				if (typeof onError === 'function') onError('script_load_failed');
			});

			return () => {
			removed = true;
			if (window.turnstile && widgetIdRef.current != null) {
					try {
						window.turnstile.remove(widgetIdRef.current);
					} catch (e) {
						// noop: ignore remove errors
						void e;
					}
			}
			widgetIdRef.current = null;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [resolvedSiteKey]);

	const renderWidget = () => {
		if (!window.turnstile || !containerRef.current || widgetIdRef.current != null) return;

		try {
			widgetIdRef.current = window.turnstile.render(containerRef.current, {
				sitekey: resolvedSiteKey,
				theme,
				size,
				action,
				cData: cdata,
				tabindex,
				'refresh-expired': 'auto',
				callback: (tk) => {
					setToken(tk);
					if (typeof onVerify === 'function') onVerify(tk);
				},
				'expired-callback': () => {
					setToken('');
					if (typeof onExpire === 'function') onExpire();
				},
				'error-callback': () => {
					setToken('');
					if (typeof onError === 'function') onError('widget_error');
				}
			});
		} catch (e) {
			console.error('Failed to render Turnstile widget:', e);
			if (typeof onError === 'function') onError('render_failed');
		}
	};

	useImperativeHandle(ref, () => ({
			reset: () => {
			setToken('');
			if (window.turnstile && widgetIdRef.current != null) {
					try {
						window.turnstile.reset(widgetIdRef.current);
					} catch (e) {
						// noop
						void e;
					}
			}
		},
		getToken: () => token,
		remove: () => {
			if (window.turnstile && widgetIdRef.current != null) {
					try {
						window.turnstile.remove(widgetIdRef.current);
					} catch (e) {
						// noop
						void e;
					}
			}
			widgetIdRef.current = null;
			setToken('');
		}
	}), [token]);

	if (siteKeyMissing) {
		return (
			<div className={`w-full ${className}`}>
				<div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-3">
					未配置 Turnstile 站点密钥（VITE_TURNSTILE_SITE_KEY）。在开发环境将跳过验证码，生产环境请务必配置。
				</div>
			</div>
		);
	}

	return (
		<div className={`${size === 'flexible' ? 'w-full max-w-full' : 'inline-block max-w-full'} ${className}`.trim()}>
			<div ref={containerRef} className={size === 'flexible' ? 'w-full max-w-full' : 'inline-block max-w-full'} />
			{/* 可选：在 require 模式下无 token 时提示 */}
			{require && !token && loaded && (
				<p className="mt-2 text-xs text-muted-foreground">请先完成验证码验证</p>
			)}
		</div>
	);
});

export default Turnstile;

