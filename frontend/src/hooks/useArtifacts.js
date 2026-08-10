import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { artifactsApi } from '../api/artifacts.js';
import { toast } from '../store/uiStore.js';

/* ── List ─────────────────────────────────────────────────────────────────── */
export function useArtifacts(params = {}) {
  return useQuery({
    queryKey: ['artifacts', params],
    queryFn: () => artifactsApi.list(params),
    enabled: true,
  });
}

export function useArtifactStats(params = {}) {
  return useQuery({
    queryKey: ['artifact-stats', params],
    queryFn: () => artifactsApi.stats(params),
    enabled: true,
  });
}

/* ── Single ───────────────────────────────────────────────────────────────── */
export function useArtifact(id) {
  return useQuery({
    queryKey: ['artifact', id],
    queryFn: () => artifactsApi.get(id),
    enabled: !!id,
  });
}

/* ── Create ───────────────────────────────────────────────────────────────── */
export function useCreateArtifact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: artifactsApi.create,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['artifacts'] });
      toast.success('Artifact created');
      return data;
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to create artifact'),
  });
}

/* ── Update ───────────────────────────────────────────────────────────────── */
export function useUpdateArtifact(id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => artifactsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['artifact', id] });
      qc.invalidateQueries({ queryKey: ['artifacts'] });
      toast.success('Saved');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to save'),
  });
}

/* ── Delete ───────────────────────────────────────────────────────────────── */
export function useDeleteArtifact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: artifactsApi.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['artifacts'] });
      toast.success('Artifact deleted');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to delete'),
  });
}

/* ── Versions ─────────────────────────────────────────────────────────────── */
export function useArtifactVersions(id, params) {
  return useQuery({
    queryKey: ['artifact-versions', id, params],
    queryFn: () => artifactsApi.versions(id, params),
    enabled: !!id,
  });
}

/* ── Links ────────────────────────────────────────────────────────────────── */
export function useArtifactLinks(id) {
  return useQuery({
    queryKey: ['artifact-links', id],
    queryFn: () => artifactsApi.links(id),
    enabled: !!id,
  });
}
