import api from './client.js';

export const artifactsApi = {
  list:    (params) => api.get('/artifacts', { params }).then((r) => r.data),
  create:  (data)   => api.post('/artifacts', data).then((r) => r.data),
  get:     (id)     => api.get(`/artifacts/${id}`).then((r) => r.data),
  update:  (id, data) => api.patch(`/artifacts/${id}`, data).then((r) => r.data),
  remove:  (id)     => api.delete(`/artifacts/${id}`).then((r) => r.data),
  stats:   (params) => api.get('/artifacts/stats', { params }).then((r) => r.data),

  // Versions
  versions:   (id, params) => api.get(`/artifacts/${id}/versions`, { params }).then((r) => r.data),
  getVersion: (id, ver)    => api.get(`/artifacts/${id}/versions/${ver}`).then((r) => r.data),

  // Links
  links:      (id)    => api.get(`/artifacts/${id}/links`).then((r) => r.data),
  createLink: (id, data) => api.post(`/artifacts/${id}/links`, data).then((r) => r.data),
  removeLink: (id, linkId) => api.delete(`/artifacts/${id}/links/${linkId}`).then((r) => r.data),
};
