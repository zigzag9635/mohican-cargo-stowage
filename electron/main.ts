import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';

const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1280,
    minHeight: 800,
    title: 'Mohican Cargo Stowage',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    const devUrl = process.env['VITE_DEV_SERVER_URL'];
    if (devUrl) {
      mainWindow.loadURL(devUrl);
    } else {
      mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? ([
          {
            label: app.name,
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              { role: 'quit' },
            ],
          },
        ] as Electron.MenuItemConstructorOptions[])
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New plan',
          accelerator: 'CmdOrCtrl+N',
          click: () => mainWindow?.webContents.send('menu:new'),
        },
        {
          label: 'Open plan…',
          accelerator: 'CmdOrCtrl+O',
          click: () => mainWindow?.webContents.send('menu:open'),
        },
        {
          label: 'Save plan',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow?.webContents.send('menu:save'),
        },
        { type: 'separator' },
        {
          label: 'Export PDF…',
          accelerator: 'CmdOrCtrl+E',
          click: () => mainWindow?.webContents.send('menu:export-pdf'),
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About M/V Mohican',
          click: () => mainWindow?.webContents.send('menu:about'),
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  buildMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('dialog:save-json', async (_evt, payload: { defaultName: string; data: string }) => {
  if (!mainWindow) return { canceled: true };
  const res = await dialog.showSaveDialog(mainWindow, {
    title: 'Save stowage plan',
    defaultPath: payload.defaultName,
    filters: [{ name: 'Stowage plan (JSON)', extensions: ['json'] }],
  });
  if (res.canceled || !res.filePath) return { canceled: true };
  await fs.writeFile(res.filePath, payload.data, 'utf8');
  return { canceled: false, filePath: res.filePath };
});

ipcMain.handle('dialog:open-json', async () => {
  if (!mainWindow) return { canceled: true };
  const res = await dialog.showOpenDialog(mainWindow, {
    title: 'Open stowage plan',
    filters: [{ name: 'Stowage plan (JSON)', extensions: ['json'] }],
    properties: ['openFile'],
  });
  if (res.canceled || res.filePaths.length === 0) return { canceled: true };
  const data = await fs.readFile(res.filePaths[0], 'utf8');
  return { canceled: false, filePath: res.filePaths[0], data };
});

ipcMain.handle('dialog:save-pdf', async (_evt, payload: { defaultName: string; data: ArrayBuffer }) => {
  if (!mainWindow) return { canceled: true };
  const res = await dialog.showSaveDialog(mainWindow, {
    title: 'Export stowage plan to PDF',
    defaultPath: payload.defaultName,
    filters: [{ name: 'PDF document', extensions: ['pdf'] }],
  });
  if (res.canceled || !res.filePath) return { canceled: true };
  await fs.writeFile(res.filePath, Buffer.from(payload.data));
  return { canceled: false, filePath: res.filePath };
});

