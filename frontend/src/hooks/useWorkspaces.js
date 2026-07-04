import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workspacesApi } from '../api/workspaces.js';
import { useUIStore, toast } from '../store/uiStore.js';

export function useWorkspaces() {
  return useQuery({
    queryKey: ['workspaces'],
    queryFn: () => workspacesApi.list(),
  });
}

export function useWorkspace(id) {
  return useQuery({
    queryKey: ['workspace', id],
    queryFn: () => workspacesApi.get(id),
    enabled: !!id,
  });
}

export function useCreateWorkspace() {
  const qc = useQueryClient();
  const setActiveWorkspace = useUIStore((s) => s.setActiveWorkspace);
  return useMutation({
    mutationFn: workspacesApi.create,
    onSuccess: ({ workspace }) => {
      qc.invalidateQueries({ queryKey: ['workspaces'] });
      setActiveWorkspace(workspace._id);
      toast.success(`Workspace "${workspace.name}" created`);
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to create workspace'),
  });
}

export function useUpdateWorkspace(id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => workspacesApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workspace', id] });
      qc.invalidateQueries({ queryKey: ['workspaces'] });
      toast.success('Workspace updated');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to update workspace'),
  });
}
