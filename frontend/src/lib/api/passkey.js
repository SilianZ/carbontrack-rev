import Silian_api from '../api';

/**
 * Passkey API client
 */
export const passkeyAPI = {
  /**
   * Get registration options from the server
   * @returns {Promise<Object>}
   */
  getRegistrationOptions: () => Silian_api.post('/users/me/passkeys/registration/options'),

  /**
   * Send the registration response to the server
   * @param {Object} data Must contain challenge_id and credential
   * @returns {Promise<Object>}
   */
  register: (Silian_data) => Silian_api.post('/users/me/passkeys/registration/verify', Silian_data),

  /**
   * Get authentication options from the server
   * @param {string} identifier email or username
   * @returns {Promise<Object>}
   */
  getAuthenticationOptions: (Silian_identifier) => Silian_api.post(
    '/auth/passkey/login/options',
    Silian_identifier ? { identifier: Silian_identifier } : {}
  ),

  /**
   * Send the authentication response to the server
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  login: (Silian_data) => Silian_api.post('/auth/passkey/login/verify', Silian_data),

  /**
   * List user's registered passkeys
   * @returns {Promise<Array>}
   */
  listPasskeys: () => Silian_api.get('/users/me/passkeys'),

  /**
   * Update a registered passkey label
   * @param {string|number} id
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  updatePasskey: (Silian_id, Silian_data) => Silian_api.patch(`/users/me/passkeys/${Silian_id}`, Silian_data),

  /**
   * Delete a registered passkey
   * @param {string} id
   * @returns {Promise<Object>}
   */
  deletePasskey: (Silian_id) => Silian_api.delete(`/users/me/passkeys/${Silian_id}`),
};

export default passkeyAPI;
