import Silian_React, { useEffect as Silian_useEffect, useImperativeHandle as Silian_useImperativeHandle, useRef as Silian_useRef, useState as Silian_useState, forwardRef as Silian_forwardRef } from 'react';

// Cloudflare Turnstile 小部件
// 使用方式：
// <Turnstile onVerify={(token) => setValue('turnstile_token', token)} ref={turnstileRef} />
// 可通过 ref.current.reset() 重置

const Silian_SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

function Silian_loadTurnstileScript() {
	return new Promise((Silian_resolve, Silian_reject) => {
		if (window.turnstile) {
			Silian_resolve(window.turnstile);
			return;
		}
		const Silian_existing = document.querySelector('script[data-turnstile]');
		if (Silian_existing) {
			Silian_existing.addEventListener('load', () => Silian_resolve(window.turnstile));
			Silian_existing.addEventListener('error', Silian_reject);
			return;
		}
		const Silian_script = document.createElement('script');
		Silian_script.src = Silian_SCRIPT_SRC;
		Silian_script.async = true;
		Silian_script.defer = true;
		Silian_script.setAttribute('data-turnstile', 'true');
		Silian_script.onload = () => Silian_resolve(window.turnstile);
		Silian_script.onerror = Silian_reject;
		document.head.appendChild(Silian_script);
	});
}

const Silian_DEFAULT_TEST_SITEKEY = '1x00000000000000000000AA'; // Cloudflare 官方测试 site key

const Silian_Turnstile = Silian_forwardRef(function Turnstile(
	{
		siteKey: Silian_siteKey = import.meta.env?.VITE_TURNSTILE_SITE_KEY || '',
		theme: Silian_theme = 'auto',
		size: Silian_size = 'normal',
		action: Silian_action,
		cdata: Silian_cdata,
		tabindex: Silian_tabindex = 0,
		className: Silian_className = '',
		onVerify: Silian_onVerify,
		onExpire: Silian_onExpire,
		onError: Silian_onError,
		onLoad: Silian_onLoad,
		require: Silian_require = false // 若为 true 且配置了 siteKey，则可在外层依据 token 判定按钮可用
	},
	Silian_ref
) {
	const Silian_containerRef = Silian_useRef(null);
	const Silian_widgetIdRef = Silian_useRef(null);
	const [Silian_loaded, Silian_setLoaded] = Silian_useState(false);
	const [Silian_token, Silian_setToken] = Silian_useState('');

	const Silian_resolvedSiteKey = Silian_siteKey || (import.meta.env?.MODE !== 'production' ? Silian_DEFAULT_TEST_SITEKEY : '');
	const Silian_siteKeyMissing = !Silian_resolvedSiteKey;

	Silian_useEffect(() => {
		let Silian_removed = false;
		if (Silian_siteKeyMissing) return; // 未配置 siteKey 时不加载脚本

		Silian_loadTurnstileScript()
			.then(() => {
				if (Silian_removed) return;
				Silian_setLoaded(true);
				if (typeof Silian_onLoad === 'function') Silian_onLoad();
				Silian_renderWidget();
			})
			.catch((Silian_err) => {
				console.error('Failed to load Turnstile script:', Silian_err);
				if (typeof Silian_onError === 'function') Silian_onError('script_load_failed');
			});

			return () => {
			Silian_removed = true;
			if (window.turnstile && Silian_widgetIdRef.current != null) {
					try {
						window.turnstile.remove(Silian_widgetIdRef.current);
					} catch (Silian_e) {
						// noop: ignore remove errors
						void Silian_e;
					}
			}
			Silian_widgetIdRef.current = null;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [Silian_resolvedSiteKey]);

	const Silian_renderWidget = () => {
		if (!window.turnstile || !Silian_containerRef.current || Silian_widgetIdRef.current != null) return;

		try {
			Silian_widgetIdRef.current = window.turnstile.render(Silian_containerRef.current, {
				sitekey: Silian_resolvedSiteKey,
				theme: Silian_theme,
				size: Silian_size,
				action: Silian_action,
				cData: Silian_cdata,
				tabindex: Silian_tabindex,
				'refresh-expired': 'auto',
				callback: (Silian_tk) => {
					Silian_setToken(Silian_tk);
					if (typeof Silian_onVerify === 'function') Silian_onVerify(Silian_tk);
				},
				'expired-callback': () => {
					Silian_setToken('');
					if (typeof Silian_onExpire === 'function') Silian_onExpire();
				},
				'error-callback': () => {
					Silian_setToken('');
					if (typeof Silian_onError === 'function') Silian_onError('widget_error');
				}
			});
		} catch (Silian_e) {
			console.error('Failed to render Turnstile widget:', Silian_e);
			if (typeof Silian_onError === 'function') Silian_onError('render_failed');
		}
	};

	Silian_useImperativeHandle(Silian_ref, () => ({
			reset: () => {
			Silian_setToken('');
			if (window.turnstile && Silian_widgetIdRef.current != null) {
					try {
						window.turnstile.reset(Silian_widgetIdRef.current);
					} catch (Silian_e) {
						// noop
						void Silian_e;
					}
			}
		},
		getToken: () => Silian_token,
		remove: () => {
			if (window.turnstile && Silian_widgetIdRef.current != null) {
					try {
						window.turnstile.remove(Silian_widgetIdRef.current);
					} catch (Silian_e) {
						// noop
						void Silian_e;
					}
			}
			Silian_widgetIdRef.current = null;
			Silian_setToken('');
		}
	}), [Silian_token]);

	if (Silian_siteKeyMissing) {
		return (
			<div className={`w-full ${Silian_className}`}>
				<div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-3">
					未配置 Turnstile 站点密钥（VITE_TURNSTILE_SITE_KEY）。在开发环境将跳过验证码，生产环境请务必配置。
				</div>
			</div>
		);
	}

	return (
		<div className={`${Silian_size === 'flexible' ? 'w-full max-w-full' : 'inline-block max-w-full'} ${Silian_className}`.trim()}>
			<div ref={Silian_containerRef} className={Silian_size === 'flexible' ? 'w-full max-w-full' : 'inline-block max-w-full'} />
			{/* 可选：在 require 模式下无 token 时提示 */}
			{Silian_require && !Silian_token && Silian_loaded && (
				<p className="mt-2 text-xs text-muted-foreground">请先完成验证码验证</p>
			)}
		</div>
	);
});

export default Silian_Turnstile;

