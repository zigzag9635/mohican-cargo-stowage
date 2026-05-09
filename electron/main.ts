import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';

const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;

type Lang = 'en' | 'ru';

const menuStrings = {
  en: {
    file: 'File',
    newPlan: 'New plan',
    openPlan: 'Open plan…',
    savePlan: 'Save plan',
    exportPdf: 'Export PDF…',
    quit: 'Quit',
    close: 'Close',
    view: 'View',
    reload: 'Reload',
    toggleDevTools: 'Toggle developer tools',
    resetZoom: 'Reset zoom',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    help: 'Help',
    about: 'About M/V Mohican',
    saveTitle: 'Save stowage plan',
    openTitle: 'Open stowage plan',
    pdfTitle: 'Export stowage plan to PDF',
    planFilter: 'Stowage plan (JSON)',
    pdfFilter: 'PDF document',
  },
  ru: {
    file: 'Файл',
    newPlan: 'Новый план',
    openPlan: 'Открыть план…',
    savePlan: 'Сохранить план',
    exportPdf: 'Экспорт в PDF…',
    quit: 'Выход',
    close: 'Закрыть',
    view: 'Вид',
    reload: 'Перезагрузить',
    toggleDevTools: 'Инструменты разработчика',
    resetZoom: 'Сбросить масштаб',
    zoomIn: 'Увеличить',
    zoomOut: 'Уменьшить',
    help: 'Справка',
    about: 'О приложении',
    saveTitle: 'Сохранить план раскладки',
    openTitle: 'Открыть план раскладки',
    pdfTitle: 'Экспорт плана в PDF',
    planFilter: 'План раскладки (JSON)',
    pdfFilter: 'Документ PDF',
  },
} as const;

let currentLang: Lang = (() => {
  const sys = (app.getLocale() || '').toLowerCase();
  return sys.startsWith('ru') ? 'ru' : 'en';
})();

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
  const s = menuStrings[currentLang];
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? ([
          {
            label: app.name,
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              { role: 'quit', label: s.quit },
            ],
          },
        ] as Electron.MenuItemConstructorOptions[])
      : []),
    {
      label: s.file,
      submenu: [
        {
          label: s.newPlan,
          accelerator: 'CmdOrCtrl+N',
          click: () => mainWindow?.webContents.send('menu:new'),
        },
        {
          label: s.openPlan,
          accelerator: 'CmdOrCtrl+O',
          click: () => mainWindow?.webContents.send('menu:open'),
        },
        {
          label: s.savePlan,
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow?.webContents.send('menu:save'),
        },
        { type: 'separator' },
        {
          label: s.exportPdf,
          accelerator: 'CmdOrCtrl+E',
          click: () => mainWindow?.webContents.send('menu:export-pdf'),
        },
        { type: 'separator' },
        isMac ? { role: 'close', label: s.close } : { role: 'quit', label: s.quit },
      ],
    },
    {
      label: s.view,
      submenu: [
        { role: 'reload', label: s.reload },
        { role: 'toggleDevTools', label: s.toggleDevTools },
        { type: 'separator' },
        { role: 'resetZoom', label: s.resetZoom },
        { role: 'zoomIn', label: s.zoomIn },
        { role: 'zoomOut', label: s.zoomOut },
      ],
    },
    {
      label: s.help,
      submenu: [
        {
          label: s.about,
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

ipcMain.handle('app:set-lang', (_evt, lang: Lang) => {
  if (lang === 'en' || lang === 'ru') {
    currentLang = lang;
    buildMenu();
  }
});

ipcMain.handle('app:get-system-lang', () => currentLang);

ipcMain.handle('dialog:save-json', async (_evt, payload: { defaultName: string; data: string }) => {
  if (!mainWindow) return { canceled: true };
  const s = menuStrings[currentLang];
  const res = await dialog.showSaveDialog(mainWindow, {
    title: s.saveTitle,
    defaultPath: payload.defaultName,
    filters: [{ name: s.planFilter, extensions: ['json'] }],
  });
  if (res.canceled || !res.filePath) return { canceled: true };
  await fs.writeFile(res.filePath, payload.data, 'utf8');
  return { canceled: false, filePath: res.filePath };
});

ipcMain.handle('dialog:open-json', async () => {
  if (!mainWindow) return { canceled: true };
  const s = menuStrings[currentLang];
  const res = await dialog.showOpenDialog(mainWindow, {
    title: s.openTitle,
    filters: [{ name: s.planFilter, extensions: ['json'] }],
    properties: ['openFile'],
  });
  if (res.canceled || res.filePaths.length === 0) return { canceled: true };
  const data = await fs.readFile(res.filePaths[0], 'utf8');
  return { canceled: false, filePath: res.filePaths[0], data };
});

ipcMain.handle('dialog:save-pdf', async (_evt, payload: { defaultName: string; data: ArrayBuffer }) => {
  if (!mainWindow) return { canceled: true };
  const s = menuStrings[currentLang];
  const res = await dialog.showSaveDialog(mainWindow, {
    title: s.pdfTitle,
    defaultPath: payload.defaultName,
    filters: [{ name: s.pdfFilter, extensions: ['pdf'] }],
  });
  if (res.canceled || !res.filePath) return { canceled: true };
  await fs.writeFile(res.filePath, Buffer.from(payload.data));
  return { canceled: false, filePath: res.filePath };
});
