import { create } from 'zustand';

export const useSocketStore = create((set) => ({
  socket: null,
  connected: false,
  daemonOnline: false,

  setSocket: (socket) => set({ socket }),
  setConnected: (connected) => set({ connected }),
  setDaemonOnline: (daemonOnline) => set({ daemonOnline }),
  reset: () => set({ socket: null, connected: false, daemonOnline: false }),
}));
