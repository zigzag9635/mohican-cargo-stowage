import { contextBridge, ipcRenderer } from 'electron';

export type SaveJsonResult =
  | { canceled: true }
  | { canceled: false; filePath: string };

export type OpenJsonResult =
  | { canceled: true }
  | { canceled: false; filePath: string; data: string };

const api = {
  saveJson: (defaultName: string, data: string): Promise<SaveJsonResult> =>
    ipcRenderer.invoke('dialog:save-json', { defaultName, data }),
  openJson: (): Promise<OpenJsonResult> => ipcRenderer.invoke('dialog:open-json'),
  savePdf: (defaultName: string, data: ArrayBuffer): Promise<SaveJsonResult> =>
    ipcRenderer.invoke('dialog:save-pdf', { defaultName, data }),
  onMenu: (channel: 'new' | 'open' | 'save' | 'export-pdf' | 'about', cb: () => void) => {
    const listener = () => cb();
    ipcRenderer.on(`menu:${channel}`, listener);
    return () => ipcRenderer.removeListener(`menu:${channel}`, listener);
  },
  setLang: (lang: 'en' | 'ru') => ipcRenderer.invoke('app:set-lang', lang),
};

contextBridge.exposeInMainWorld('api', api);

export type ElectronApi = typeof api;
