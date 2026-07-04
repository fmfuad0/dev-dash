import api from './client.js';

export const searchApi = {
  search: (params) => api.get('/search', { params }).then((r) => r.data),
  tags:   (params) => api.get('/search/tags', { params }).then((r) => r.data),
};

export const vaultApi = {
  list:   (params) => api.get('/vault/items', { params }).then((r) => r.data),
  create: (data)   => api.post('/vault/items', data).then((r) => r.data),
  get:    (id)     => api.get(`/vault/items/${id}`).then((r) => r.data),
  remove: (id)     => api.delete(`/vault/items/${id}`).then((r) => r.data),
};

export const terminalApi = {
  list:    (params) => api.get('/terminal/events', { params }).then((r) => r.data),
  capture: (data)   => api.post('/terminal/events', data).then((r) => r.data),
};

export const devicesApi = {
  list:      ()      => api.get('/devices').then((r) => r.data),
  register:  (data)  => api.post('/devices', data).then((r) => r.data),
  heartbeat: (id)    => api.patch(`/devices/${id}/heartbeat`).then((r) => r.data),
  revoke:    (id)    => api.delete(`/devices/${id}`).then((r) => r.data),
};

export const syncApi = {
  push: (mutations) => api.post('/sync/push', { mutations }).then((r) => r.data),
  pull: (params)    => api.get('/sync/pull', { params }).then((r) => r.data),
};
