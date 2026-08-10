import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Server, X } from 'lucide-react';
import api from '../../api/client.js';
import { toast } from '../../store/uiStore.js';
import Modal from '../UI/Modal.jsx';

export default function ServerConnectionModal({ onClose, onSuccess, editData }) {
  const [formData, setFormData] = useState({
    name: editData?.name || '',
    host: editData?.host || '',
    port: editData?.port || 22,
    username: editData?.username || '',
    password: editData?.password || '',
    privateKey: editData?.privateKey || ''
  });

  const mutation = useMutation({
    mutationFn: (data) => 
      editData 
        ? api.put(`/remote/connections/${editData._id}`, data).then(r => r.data)
        : api.post('/remote/connections', data).then(r => r.data),
    onSuccess: () => {
      toast.success(editData ? 'Server connection updated' : 'Server connection added');
      onSuccess();
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || (editData ? 'Failed to update connection' : 'Failed to add connection'));
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  return (
    <Modal title={editData ? "Edit Remote Server" : "Add Remote Server"} onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }} >
        
        <div className="form-group">
          <label>Connection Name (e.g., Production DB)</label>
          <input 
            type="text" 
            className="input" 
            required 
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            placeholder="My AWS Server"
          />
        </div>

        <div style={{ display: 'flex', gap: '15px' }}>
          <div className="form-group" style={{ flex: 2 }}>
            <label>Hostname / IP</label>
            <input 
              type="text" 
              className="input" 
              required 
              value={formData.host}
              onChange={e => setFormData({ ...formData, host: e.target.value })}
              placeholder="192.168.1.100"
            />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label>Port</label>
            <input 
              type="number" 
              className="input" 
              required 
              value={formData.port}
              onChange={e => setFormData({ ...formData, port: Number(e.target.value) })}
            />
          </div>
        </div>

        <div className="form-group">
          <label>Username</label>
          <input 
            type="text" 
            className="input" 
            required 
            value={formData.username}
            onChange={e => setFormData({ ...formData, username: e.target.value })}
            placeholder="root"
            autoComplete="off"
          />
        </div>

        <div className="form-group">
          <label>Password (Optional)</label>
          <input 
            type="password" 
            className="input" 
            value={formData.password}
            onChange={e => setFormData({ ...formData, password: e.target.value })}
            autoComplete="off"
          />
        </div>

        <div className="form-group">
          <label>Private Key (Optional, takes precedence over password)</label>
          <textarea 
            className="input" 
            rows={4}
            value={formData.privateKey}
            onChange={e => setFormData({ ...formData, privateKey: e.target.value })}
            placeholder="-----BEGIN RSA PRIVATE KEY-----..."
            style={{ fontFamily: 'monospace', fontSize: '12px' }}
            autoComplete="off"
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving...' : (editData ? 'Update Connection' : 'Add Connection')}
          </button>
        </div>

      </form>
    </Modal>
  );
}
