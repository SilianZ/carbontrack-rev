/**
 * Passkey Utility Layer
 * Handles WebAuthn data transformations between browser and backend.
 */

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
 * Checks if the browser supports WebAuthn.
 * We no longer require `isUserVerifyingPlatformAuthenticatorAvailable()` to return true,
 * because users may use roaming authenticators (like a security key, or hybrid cross-device flows).
 * @returns {Promise<boolean>}
 */
export async function isPasskeySupported() {
  return !!window.PublicKeyCredential;
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
