import api from './client.js';

export const workspacesApi = {
  list:   (params) => api.get('/workspaces', { params }).then((r) => r.data),
  create: (data)   => api.post('/workspaces', data).then((r) => r.data),
  get:    (id)     => api.get(`/workspaces/${id}`).then((r) => r.data),
  update: (id, data) => api.patch(`/workspaces/${id}`, data).then((r) => r.data),
  archive:(id)     => api.delete(`/workspaces/${id}`).then((r) => r.data),
};
