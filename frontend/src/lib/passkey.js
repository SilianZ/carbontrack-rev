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
export function base64urlToArrayBuffer(Silian_base64url) {
  const Silian_base64 = Silian_base64url.replace(/-/g, '+').replace(/_/g, '/');
  const Silian_padLen = (4 - (Silian_base64.length % 4)) % 4;
  const Silian_paddedBase64 = Silian_base64 + '='.repeat(Silian_padLen);
  const Silian_binary = window.atob(Silian_paddedBase64);
  const Silian_bytes = new Uint8Array(Silian_binary.length);
  for (let Silian_i = 0; Silian_i < Silian_binary.length; Silian_i++) {
    Silian_bytes[Silian_i] = Silian_binary.charCodeAt(Silian_i);
  }
  return Silian_bytes.buffer;
}

/**
 * Converts an ArrayBuffer to a Base64URL string.
 * @param {ArrayBuffer} buffer
 * @returns {string}
 */
export function arrayBufferToBase64url(Silian_buffer) {
  const Silian_bytes = new Uint8Array(Silian_buffer);
  const Silian_len = Silian_bytes.byteLength;
  const Silian_CHUNK_SIZE = 8192;
  const Silian_chunks = [];

  for (let Silian_i = 0; Silian_i < Silian_len; Silian_i += Silian_CHUNK_SIZE) {
    Silian_chunks.push(String.fromCharCode.apply(null, Silian_bytes.subarray(Silian_i, Silian_i + Silian_CHUNK_SIZE)));
  }

  const Silian_binary = Silian_chunks.join('');
  const Silian_base64 = window.btoa(Silian_binary);
  return Silian_base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
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

  const Silian_canAuthenticate = Boolean(navigator.credentials && typeof navigator.credentials.get === 'function');
  const Silian_canRegister = Boolean(navigator.credentials && typeof navigator.credentials.create === 'function');

  if (!Silian_canAuthenticate) {
    return {
      supported: false,
      canAuthenticate: Silian_canAuthenticate,
      canRegister: Silian_canRegister,
      reason: PASSKEY_SUPPORT_REASONS.MISSING_CREDENTIALS_API,
    };
  }

  return {
    supported: true,
    canAuthenticate: Silian_canAuthenticate,
    canRegister: Silian_canRegister,
    reason: Silian_canRegister ? null : PASSKEY_SUPPORT_REASONS.MISSING_CREDENTIALS_API,
  };
}

/**
 * Legacy boolean helper for existing call sites.
 * @returns {Promise<boolean>}
 */
export async function isPasskeySupported() {
  const Silian_support = await getPasskeySupport();
  return Silian_support.supported;
}

/**
 * Prepares registration options for navigator.credentials.create.
 * Converts Base64URL strings to ArrayBuffers.
 * @param {Object} options
 * @returns {Object}
 */
export function prepareRegistrationOptions(Silian_options) {
  const Silian_credentialOptions = {
    ...Silian_options,
    challenge: base64urlToArrayBuffer(Silian_options.challenge),
    user: {
      ...Silian_options.user,
      id: base64urlToArrayBuffer(Silian_options.user.id),
    },
  };

  if (Silian_options.excludeCredentials) {
    Silian_credentialOptions.excludeCredentials = Silian_options.excludeCredentials.map((Silian_cred) => ({
      ...Silian_cred,
      id: base64urlToArrayBuffer(Silian_cred.id),
    }));
  }

  return { publicKey: Silian_credentialOptions };
}

/**
 * Prepares authentication options for navigator.credentials.get.
 * Converts Base64URL strings to ArrayBuffers.
 * @param {Object} options
 * @returns {Object}
 */
export function prepareAuthenticationOptions(Silian_options) {
  const Silian_credentialOptions = {
    ...Silian_options,
    challenge: base64urlToArrayBuffer(Silian_options.challenge),
  };

  if (Silian_options.allowCredentials) {
    Silian_credentialOptions.allowCredentials = Silian_options.allowCredentials.map((Silian_cred) => ({
      ...Silian_cred,
      id: base64urlToArrayBuffer(Silian_cred.id),
    }));
  }

  return { publicKey: Silian_credentialOptions };
}

/**
 * Encodes the credential object from navigator.credentials.create for the backend.
 * @param {PublicKeyCredential} credential
 * @returns {Object}
 */
export function encodeRegistrationResponse(Silian_credential) {
  const Silian_response = Silian_credential.response;
  return {
    id: Silian_credential.id,
    rawId: arrayBufferToBase64url(Silian_credential.rawId),
    type: Silian_credential.type,
    response: {
      attestationObject: arrayBufferToBase64url(Silian_response.attestationObject),
      clientDataJSON: arrayBufferToBase64url(Silian_response.clientDataJSON),
    },
    authenticatorAttachment: Silian_credential.authenticatorAttachment,
  };
}

/**
 * Encodes the credential object from navigator.credentials.get for the backend.
 * @param {PublicKeyCredential} credential
 * @returns {Object}
 */
export function encodeAuthenticationResponse(Silian_credential) {
  const Silian_response = Silian_credential.response;
  return {
    id: Silian_credential.id,
    rawId: arrayBufferToBase64url(Silian_credential.rawId),
    type: Silian_credential.type,
    response: {
      authenticatorData: arrayBufferToBase64url(Silian_response.authenticatorData),
      clientDataJSON: arrayBufferToBase64url(Silian_response.clientDataJSON),
      signature: arrayBufferToBase64url(Silian_response.signature),
      userHandle: Silian_response.userHandle ? arrayBufferToBase64url(Silian_response.userHandle) : null,
    },
    authenticatorAttachment: Silian_credential.authenticatorAttachment,
  };
}

/**
 * Global feature flag for Passkey support.
 * Can be controlled via environment variable.
 */
export const IS_PASSKEY_ENABLED = import.meta.env.VITE_ENABLE_PASSKEY === 'true';
