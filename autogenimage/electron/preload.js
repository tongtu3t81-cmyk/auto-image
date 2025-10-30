import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  saveImage: (payload) => ipcRenderer.invoke('save-image', payload),
});
