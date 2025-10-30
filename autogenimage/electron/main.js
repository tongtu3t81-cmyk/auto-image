import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;

const createWindow = async () => {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  const distIndexPath = path.join(__dirname, 'dist', 'index.html');

  await mainWindow.loadFile(distIndexPath);

  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

const decodeDataUrlToBuffer = (dataUrl) => {
  const matches = /^data:(?<mime>.*?);base64,(?<data>.+)$/.exec(dataUrl ?? '');
  if (!matches?.groups?.data) {
    throw new Error('Invalid data URL received');
  }
  return Buffer.from(matches.groups.data, 'base64');
};

ipcMain.handle('save-image', async (_event, payload) => {
  try {
    if (!mainWindow) {
      throw new Error('Main window is not available');
    }

    const { dataUrl, defaultFileName } = payload ?? {};
    if (!dataUrl || !defaultFileName) {
      throw new Error('Missing data for save-image request');
    }

    const buffer = decodeDataUrlToBuffer(dataUrl);

    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Lưu ảnh',
      defaultPath: defaultFileName,
      filters: [
        { name: 'JPEG Image', extensions: ['jpg', 'jpeg'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (canceled || !filePath) {
      return { canceled: true };
    }

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, buffer);

    return { canceled: false, filePath };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { canceled: false, error: message };
  }
});

app.whenReady().then(async () => {
  await createWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
