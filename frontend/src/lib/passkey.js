/**
 * Passkey Utility Layer
 * Handles WebAuthn data transformations between browser and backend.
 */

export const PASSKEY_SUPPORT_REASONS = {
  INSECURE_CONTEXT: 'insecure_context',
  MISSING_PUBLIC_KEY_CREDENTIAL: 'missing_public_key_credential',
  MISSING_CREDENTIALS_API: 'missing_credentials_api',
};

/**
 * Converts a Base64URL string to an ArrayBuffer.
 * @param {string} base64url 
 * @returns {ArrayBuffer}
 */
export function base64urlToArrayBuffer(base64url) {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (base64.length % 4)) % 4;
  const paddedBase64 = base64 + '='.repeat(padLen);
  const binary = window.atob(paddedBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Converts an ArrayBuffer to a Base64URL string.
 * @param {ArrayBuffer} buffer 
 * @returns {string}
 */
export function arrayBufferToBase64url(buffer) {
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  const CHUNK_SIZE = 8192;
  const chunks = [];
  
  for (let i = 0; i < len; i += CHUNK_SIZE) {
    chunks.push(String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK_SIZE)));
  }
  
  const binary = chunks.join('');
  const base64 = window.btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Checks whether passkey authentication and registration can be attempted in the current environment.
 * @returns {Promise<{supported: boolean, canAuthenticate: boolean, canRegister: boolean, reason: string | null}>}
 */
export async function getPasskeySupport() {
  if (typeof window.isSecureContext === 'boolean' && !window.isSecureContext) {
    return {
      supported: false,
      canAuthenticate: false,
      canRegister: false,
      reason: PASSKEY_SUPPORT_REASONS.INSECURE_CONTEXT,
    };
  }

  if (!window.PublicKeyCredential) {
    return {
      supported: false,
      canAuthenticate: false,
      canRegister: false,
      reason: PASSKEY_SUPPORT_REASONS.MISSING_PUBLIC_KEY_CREDENTIAL,
    };
  }

  const canAuthenticate = Boolean(navigator.credentials && typeof navigator.credentials.get === 'function');
  const canRegister = Boolean(navigator.credentials && typeof navigator.credentials.create === 'function');

  if (!canAuthenticate) {
    return {
      supported: false,
      canAuthenticate,
      canRegister,
      reason: PASSKEY_SUPPORT_REASONS.MISSING_CREDENTIALS_API,
    };
  }

  return {
    supported: true,
    canAuthenticate,
    canRegister,
    reason: canRegister ? null : PASSKEY_SUPPORT_REASONS.MISSING_CREDENTIALS_API,
  };
}

/**
 * Legacy boolean helper for existing call sites.
 * @returns {Promise<boolean>}
 */
export async function isPasskeySupported() {
  const support = await getPasskeySupport();
  return support.supported;
}

/**
 * Prepares registration options for navigator.credentials.create.
 * Converts Base64URL strings to ArrayBuffers.
 * @param {Object} options 
 * @returns {Object}
 */
export function prepareRegistrationOptions(options) {
  const credentialOptions = {
    ...options,
    challenge: base64urlToArrayBuffer(options.challenge),
    user: {
      ...options.user,
      id: base64urlToArrayBuffer(options.user.id),
    },
  };

  if (options.excludeCredentials) {
    credentialOptions.excludeCredentials = options.excludeCredentials.map((cred) => ({
      ...cred,
      id: base64urlToArrayBuffer(cred.id),
    }));
  }

  return { publicKey: credentialOptions };
}

/**
 * Prepares authentication options for navigator.credentials.get.
 * Converts Base64URL strings to ArrayBuffers.
 * @param {Object} options 
 * @returns {Object}
 */
export function prepareAuthenticationOptions(options) {
  const credentialOptions = {
    ...options,
    challenge: base64urlToArrayBuffer(options.challenge),
  };

  if (options.allowCredentials) {
    credentialOptions.allowCredentials = options.allowCredentials.map((cred) => ({
      ...cred,
      id: base64urlToArrayBuffer(cred.id),
    }));
  }

  return { publicKey: credentialOptions };
}

/**
 * Encodes the credential object from navigator.credentials.create for the backend.
 * @param {PublicKeyCredential} credential 
 * @returns {Object}
 */
export function encodeRegistrationResponse(credential) {
  const response = credential.response;
  return {
    id: credential.id,
    rawId: arrayBufferToBase64url(credential.rawId),
    type: credential.type,
    response: {
      attestationObject: arrayBufferToBase64url(response.attestationObject),
      clientDataJSON: arrayBufferToBase64url(response.clientDataJSON),
    },
    authenticatorAttachment: credential.authenticatorAttachment,
  };
}

/**
 * Encodes the credential object from navigator.credentials.get for the backend.
 * @param {PublicKeyCredential} credential 
 * @returns {Object}
 */
export function encodeAuthenticationResponse(credential) {
  const response = credential.response;
  return {
    id: credential.id,
    rawId: arrayBufferToBase64url(credential.rawId),
    type: credential.type,
    response: {
      authenticatorData: arrayBufferToBase64url(response.authenticatorData),
      clientDataJSON: arrayBufferToBase64url(response.clientDataJSON),
      signature: arrayBufferToBase64url(response.signature),
      userHandle: response.userHandle ? arrayBufferToBase64url(response.userHandle) : null,
    },
    authenticatorAttachment: credential.authenticatorAttachment,
  };
}

/**
 * Global feature flag for Passkey support.
 * Can be controlled via environment variable.
 */
export const IS_PASSKEY_ENABLED = import.meta.env.VITE_ENABLE_PASSKEY === 'true';
