import api from '../api';

/**
 * Passkey API client
 */
export const passkeyAPI = {
  /**
   * Get registration options from the server
   * @returns {Promise<Object>}
   */
  getRegistrationOptions: () => api.post('/users/me/passkeys/registration/options'),

  /**
   * Send the registration response to the server
   * @param {Object} data Must contain challenge_id and credential
   * @returns {Promise<Object>}
   */
  register: (data) => api.post('/users/me/passkeys/registration/verify', data),

  /**
   * Get authentication options from the server
   * @param {string} identifier email or username
   * @returns {Promise<Object>}
   */
  getAuthenticationOptions: (identifier) => api.post('/auth/passkey/login/options', { identifier }),

  /**
   * Send the authentication response to the server
   * @param {Object} data 
   * @returns {Promise<Object>}
   */
  login: (data) => api.post('/auth/passkey/login/verify', data),

  /**
   * List user's registered passkeys
   * @returns {Promise<Array>}
   */
  listPasskeys: () => api.get('/users/me/passkeys'),

  /**
   * Delete a registered passkey
   * @param {string} id 
   * @returns {Promise<Object>}
   */
  deletePasskey: (id) => api.delete(`/users/me/passkeys/${id}`),
};

export default passkeyAPI;
