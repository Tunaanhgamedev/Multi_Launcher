const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

let mainWindow;
let activeJob = null;

function findChrome() {
  const candidates = [
    process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, "Google", "Chrome", "Application", "chrome.exe"),
    process.env["PROGRAMFILES(X86)"] && path.join(process.env["PROGRAMFILES(X86)"], "Google", "Chrome", "Application", "chrome.exe"),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe")
  ].filter(Boolean);
  return candidates.find((p) => fs.existsSync(p)) || null;
}

function getPredefinedApps() {
  const win = process.env.SystemRoot || "C:\\Windows";
  const pf = process.env.PROGRAMFILES || "C:\\Program Files";
  const pfx86 = process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)";
  const local = process.env.LOCALAPPDATA || "";

  return [
    {
      id: "chrome",
      name: "Google Chrome",
      type: "browser",
      category: "Trình duyệt",
      icon: "🌐",
      candidates: [
        path.join(pf, "Google", "Chrome", "Application", "chrome.exe"),
        path.join(pfx86, "Google", "Chrome", "Application", "chrome.exe"),
        path.join(local, "Google", "Chrome", "Application", "chrome.exe")
      ],
      windowPattern: "Chrome"
    },
    {
      id: "edge",
      name: "Microsoft Edge",
      type: "browser",
      category: "Trình duyệt",
      icon: "🌐",
      candidates: [
        path.join(pfx86, "Microsoft", "Edge", "Application", "msedge.exe"),
        path.join(pf, "Microsoft", "Edge", "Application", "msedge.exe")
      ],
      windowPattern: "Edge"
    },
    {
      id: "coccoc",
      name: "Cốc Cốc Browser",
      type: "browser",
      category: "Trình duyệt",
      icon: "🌴",
      candidates: [
        path.join(pf, "CocCoc", "Browser", "Application", "browser.exe"),
        path.join(pfx86, "CocCoc", "Browser", "Application", "browser.exe"),
        path.join(local, "CocCoc", "Browser", "Application", "browser.exe")
      ],
      windowPattern: "Cốc Cốc|CocCoc|browser"
    },
    {
      id: "brave",
      name: "Brave Browser",
      type: "browser",
      category: "Trình duyệt",
      icon: "🦁",
      candidates: [
        path.join(pf, "BraveSoftware", "Brave-Browser", "Application", "brave.exe"),
        path.join(local, "BraveSoftware", "Brave-Browser", "Application", "brave.exe")
      ],
      windowPattern: "Brave"
    },
    {
      id: "firefox",
      name: "Mozilla Firefox",
      type: "browser",
      category: "Trình duyệt",
      icon: "🦊",
      candidates: [
        path.join(pf, "Mozilla Firefox", "firefox.exe"),
        path.join(pfx86, "Mozilla Firefox", "firefox.exe")
      ],
      windowPattern: "Firefox"
    },
    {
      id: "opera",
      name: "Opera",
      type: "browser",
      category: "Trình duyệt",
      icon: "🔴",
      candidates: [
        path.join(local, "Programs", "Opera", "launcher.exe"),
        path.join(pf, "Opera", "launcher.exe"),
        path.join(local, "Programs", "Opera GX", "launcher.exe")
      ],
      windowPattern: "Opera"
    },
    {
      id: "vscode",
      name: "Visual Studio Code",
      type: "app",
      category: "Lập trình & Dev",
      icon: "💻",
      candidates: [
        path.join(local, "Programs", "Microsoft VS Code", "Code.exe"),
        path.join(pf, "Microsoft VS Code", "Code.exe")
      ],
      windowPattern: "Visual Studio Code"
    },
    {
      id: "notepad",
      name: "Notepad (Ghi chú)",
      type: "app",
      category: "Tiện ích Windows",
      icon: "📝",
      candidates: [
        path.join(win, "System32", "notepad.exe"),
        path.join(win, "notepad.exe")
      ],
      windowPattern: "Notepad"
    },
    {
      id: "calc",
      name: "Calculator (Máy tính)",
      type: "app",
      category: "Tiện ích Windows",
      icon: "🔢",
      candidates: [
        path.join(win, "System32", "calc.exe")
      ],
      windowPattern: "Calculator|Máy tính"
    },
    {
      id: "terminal",
      name: "Windows Terminal",
      type: "app",
      category: "Tiện ích Windows",
      icon: "⚡",
      candidates: [
        path.join(local, "Microsoft", "WindowsApps", "wt.exe")
      ],
      windowPattern: "Terminal"
    },
    {
      id: "cmd",
      name: "Command Prompt (CMD)",
      type: "app",
      category: "Tiện ích Windows",
      icon: "⬛",
      candidates: [
        path.join(win, "System32", "cmd.exe")
      ],
      windowPattern: "cmd.exe"
    },
    {
      id: "excel",
      name: "Microsoft Excel",
      type: "app",
      category: "Văn phòng",
      icon: "📊",
      candidates: [
        path.join(pf, "Microsoft Office", "Root", "Office16", "EXCEL.EXE"),
        path.join(pfx86, "Microsoft Office", "Root", "Office16", "EXCEL.EXE")
      ],
      windowPattern: "Excel"
    },
    {
      id: "word",
      name: "Microsoft Word",
      type: "app",
      category: "Văn phòng",
      icon: "📄",
      candidates: [
        path.join(pf, "Microsoft Office", "Root", "Office16", "WINWORD.EXE"),
        path.join(pfx86, "Microsoft Office", "Root", "Office16", "WINWORD.EXE")
      ],
      windowPattern: "Word"
    }
  ];
}

function getRegistryApps() {
  if (process.platform !== "win32") return Promise.resolve([]);
  return new Promise((resolve) => {
    const ps = String.raw`
$apps = @()
$keys = @('HKLM:\Software\Microsoft\Windows\CurrentVersion\App Paths', 'HKCU:\Software\Microsoft\Windows\CurrentVersion\App Paths')
foreach ($k in $keys) {
  if (Test-Path $k) {
    Get-ChildItem -Path $k -ErrorAction SilentlyContinue | ForEach-Object {
      $rawVal = (Get-ItemProperty -Path $_.PSPath -ErrorAction SilentlyContinue).'(default)'
      if ($rawVal) {
        $cleanVal = $rawVal.Trim('"')
        if ($cleanVal.EndsWith('.exe', [System.StringComparison]::OrdinalIgnoreCase) -and (Test-Path $cleanVal)) {
          $apps += [PSCustomObject]@{ Key = $_.PSChildName; Path = $cleanVal }
        }
      }
    }
  }
}
$apps | ConvertTo-Json -Compress
`;
    const child = spawn("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps], { windowsHide: true });
    let out = "";
    child.stdout.on("data", (d) => (out += d.toString()));
    child.on("close", (code) => {
      if (code === 0 && out.trim()) {
        try {
          const parsed = JSON.parse(out.trim());
          const arr = Array.isArray(parsed) ? parsed : [parsed];
          const results = arr.map((item) => {
            const baseName = item.Key ? item.Key.replace(/\.exe$/i, "") : path.basename(item.Path, ".exe");
            const isBrowser = /chrome|msedge|browser|brave|firefox|opera/i.test(item.Key || "");
            return {
              id: "reg-" + (item.Key || baseName).toLowerCase().replace(/[^a-z0-9_-]/g, "_"),
              name: baseName,
              path: item.Path,
              type: isBrowser ? "browser" : "app",
              category: "Phần mềm hệ thống",
              icon: isBrowser ? "🌐" : "📦",
              windowPattern: baseName
            };
          });
          resolve(results);
        } catch {
          resolve([]);
        }
      } else {
        resolve([]);
      }
    });
    child.on("error", () => resolve([]));
  });
}

async function getAllDetectedApps() {
  const predefined = getPredefinedApps();
  const regApps = await getRegistryApps();

  const detected = [];
  const foundPaths = new Set();

  for (const item of predefined) {
    let resolvedPath = item.candidates.find((p) => p && fs.existsSync(p)) || null;

    if (!resolvedPath) {
      const match = regApps.find((r) => {
        const rName = r.name.toLowerCase();
        const iId = item.id.toLowerCase();
        return rName.includes(iId) || (item.id === "coccoc" && rName.includes("browser"));
      });
      if (match && fs.existsSync(match.path)) {
        resolvedPath = match.path;
      }
    }

    if (resolvedPath) {
      foundPaths.add(resolvedPath.toLowerCase());
    }

    detected.push({
      id: item.id,
      name: item.name,
      path: resolvedPath,
      type: item.type,
      category: item.category,
      icon: item.icon,
      available: Boolean(resolvedPath),
      windowPattern: item.windowPattern
    });
  }

  // Bổ sung các ứng dụng thú vị khác từ Registry nếu chưa có trong predefined
  const ignoredPatterns = /^(cmmgr|dexplore|dfshim|iediag|install|licensemanager|lync|mplayer|mso|ois|sdxhelper|shellmcp|skypesrv|tabtip|tp|wab|winget)/i;
  for (const reg of regApps) {
    if (foundPaths.has(reg.path.toLowerCase())) continue;
    if (ignoredPatterns.test(reg.name)) continue;
    foundPaths.add(reg.path.toLowerCase());

    let friendlyCategory = "Ứng dụng máy tính";
    let icon = "📦";
    const lowName = reg.name.toLowerCase();
    if (/code|devenv|gns3|wsl|wt|powershell/i.test(lowName)) {
      friendlyCategory = "Lập trình & Kỹ thuật";
      icon = "💻";
    } else if (/pdf|winrar|vmware|games|teams|outlook|foxit/i.test(lowName)) {
      friendlyCategory = "Văn phòng & Tiện ích";
      icon = /teams|outlook/i.test(lowName) ? "💬" : /pdf|foxit/i.test(lowName) ? "📑" : "📦";
    }

    detected.push({
      id: reg.id,
      name: reg.name,
      path: reg.path,
      type: reg.type,
      category: friendlyCategory,
      icon,
      available: true,
      windowPattern: reg.windowPattern
    });
  }

  return detected;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 960,
    height: 820,
    minWidth: 720,
    minHeight: 640,
    title: "Multi Launcher",
    backgroundColor: "#0c1017",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  } else {
    mainWindow.loadURL("http://127.0.0.1:5173");
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sendProgress(payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("launcher:progress", payload);
  }
}

function normalizeUrls(raw, count) {
  const entries = String(raw || "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!entries.length) return ["https://www.google.com"];
  const urls = entries.map((entry) => {
    const candidate = /^https?:\/\//i.test(entry) ? entry : `https://${entry}`;
    let parsed;
    try {
      parsed = new URL(candidate);
    } catch {
      throw new Error(`URL không hợp lệ: ${entry}`);
    }
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error(`Chỉ hỗ trợ URL http/https: ${entry}`);
    return parsed.href;
  });
  return Array.from({ length: count }, (_, i) => urls[i % urls.length]);
}

async function arrangeWindows(targetPattern = "Chrome") {
  if (process.platform !== "win32") return { arranged: false, message: "Sắp xếp lưới chỉ được hỗ trợ trên Windows." };
  const safePattern = String(targetPattern || "Chrome").replace(/'/g, "''");
  const ps = String.raw`
param($pat = '${safePattern}')
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class Win32 {
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc cb, IntPtr extra);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
  [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool repaint);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
}
"@
$wins = New-Object System.Collections.Generic.List[System.IntPtr]
[Win32]::EnumWindows({
  param($h, $l)
  if ([Win32]::IsWindowVisible($h)) {
    $sb = New-Object System.Text.StringBuilder 512
    [void][Win32]::GetWindowText($h, $sb, $sb.Capacity)
    $text = $sb.ToString()
    if ($text -and ($text -match $pat)) { $wins.Add($h) }
  }
  return $true
}, [IntPtr]::Zero)
$screen = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
$n = $wins.Count
if ($n -gt 0) {
  $cols = [Math]::Ceiling([Math]::Sqrt($n))
  $rows = [Math]::Ceiling($n / $cols)
  $w = [Math]::Floor($screen.Width / $cols)
  $h = [Math]::Floor($screen.Height / $rows)
  for ($i=0; $i -lt $n; $i++) {
    $x = $screen.Left + (($i % $cols) * $w)
    $y = $screen.Top + ([Math]::Floor($i / $cols) * $h)
    [void][Win32]::MoveWindow($wins[$i], $x, $y, $w, $h, $true)
  }
}
Write-Output $wins.Count
`;
  return new Promise((resolve) => {
    const child = spawn(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "Add-Type -AssemblyName System.Windows.Forms; " + ps],
      { windowsHide: true }
    );
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (err += d.toString()));
    child.on("close", (code) => {
      if (code === 0) resolve({ arranged: true, message: `Đã sắp xếp ${out.trim() || "các"} cửa sổ trên màn hình.` });
      else resolve({ arranged: false, message: `Không thể sắp xếp tự động: ${err.trim() || "PowerShell trả về lỗi."}` });
    });
    child.on("error", () => resolve({ arranged: false, message: "Không thể khởi chạy PowerShell để sắp xếp cửa sổ." }));
  });
}

function launchAppProcess(executablePath, args = []) {
  const ext = path.extname(executablePath).toLowerCase();
  if (ext === ".lnk") {
    shell.openPath(executablePath);
    return null;
  }
  const child = spawn(executablePath, args, {
    detached: true,
    stdio: "ignore",
    windowsHide: false
  });
  child.on("error", (e) => {
    sendProgress({ type: "warning", message: `Không thể khởi chạy ${path.basename(executablePath)}: ${e.message}` });
  });
  child.unref();
  return child;
}

// IPC Handlers
ipcMain.handle("launcher:chrome-path", () => ({ path: findChrome(), platform: process.platform }));

ipcMain.handle("launcher:get-detected-apps", async () => {
  return await getAllDetectedApps();
});

ipcMain.handle("launcher:browse-app", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: "Chọn ứng dụng trên máy tính",
    properties: ["openFile"],
    filters: [
      { name: "Tệp ứng dụng & Scripts (.exe, .bat, .cmd, .lnk)", extensions: ["exe", "bat", "cmd", "lnk"] },
      { name: "Tất cả các tệp", extensions: ["*"] }
    ]
  });

  if (canceled || !filePaths.length) {
    return { canceled: true };
  }

  const selectedPath = filePaths[0];
  const baseName = path.basename(selectedPath, path.extname(selectedPath));
  const isBrowser = /chrome|edge|coccoc|brave|firefox|opera|browser/i.test(baseName);

  return {
    canceled: false,
    app: {
      id: "custom-" + Date.now(),
      name: baseName,
      path: selectedPath,
      type: isBrowser ? "browser" : "app",
      category: "Ứng dụng tự chọn",
      icon: isBrowser ? "🌐" : "📁",
      available: true,
      isCustom: true,
      windowPattern: baseName
    }
  };
});

ipcMain.handle("launcher:stop", () => {
  if (activeJob) activeJob.cancelled = true;
  return { ok: true };
});

ipcMain.handle("launcher:start", async (_event, config) => {
  if (activeJob) return { ok: false, error: "Một tác vụ đang chạy. Hãy dừng tác vụ đó trước." };

  const modeType = config.modeType || "single-app"; // 'single-app' | 'multi-app'
  const delayMs = Math.max(0, Math.min(10000, Number(config.delayMs) || 0));

  const job = { cancelled: false };
  activeJob = job;

  try {
    if (modeType === "multi-app") {
      // Chế độ mở tổ hợp nhiều ứng dụng
      const apps = Array.isArray(config.selectedApps) ? config.selectedApps : [];
      if (!apps.length) {
        return { ok: false, error: "Hãy chọn ít nhất một ứng dụng để mở." };
      }

      const total = apps.length;
      let opened = 0;
      const urlList = (config.urls || "")
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);

      for (let i = 0; i < apps.length; i++) {
        if (job.cancelled) break;
        const currentApp = apps[i];
        if (!currentApp.path || !fs.existsSync(currentApp.path)) {
          sendProgress({ type: "warning", message: `Không tìm thấy file của ${currentApp.name}. Bỏ qua.` });
          continue;
        }

        let args = [];
        if (currentApp.type === "browser") {
          const browserMode = config.browserMode === "windows" ? "windows" : "tabs";
          const isFirefox = /firefox/i.test(currentApp.name || currentApp.path);
          if (urlList.length > 0) {
            const url = urlList[i % urlList.length];
            const prefix = isFirefox ? (browserMode === "windows" ? "-new-window" : "-new-tab") : (browserMode === "windows" ? "--new-window" : "--new-tab");
            args = [prefix, url];
          }
        } else if (currentApp.customArgs) {
          args = String(currentApp.customArgs).split(" ").filter(Boolean);
        }

        launchAppProcess(currentApp.path, args);
        opened++;
        sendProgress({
          type: "progress",
          opened,
          total,
          message: `Đã mở: ${currentApp.name} (${opened}/${total})`
        });

        if (i < apps.length - 1 && delayMs > 0) {
          await delay(delayMs);
        }
      }

      const cancelled = job.cancelled;
      sendProgress({
        type: "done",
        opened,
        total,
        cancelled,
        message: cancelled ? `Đã dừng. Đã mở ${opened}/${total} ứng dụng.` : `Hoàn tất: Đã mở thành công ${opened}/${total} ứng dụng.`
      });

      return { ok: true, opened, total, cancelled };
    } else {
      // Chế độ mở hàng loạt 1 ứng dụng
      const targetApp = config.targetApp || {
        path: findChrome(),
        name: "Google Chrome",
        type: "browser",
        windowPattern: "Chrome"
      };

      if (!targetApp.path || !fs.existsSync(targetApp.path)) {
        return { ok: false, error: `Không tìm thấy ứng dụng ${targetApp.name || "được chọn"}. Vui lòng kiểm tra lại đường dẫn.` };
      }

      const count = Math.max(1, Math.min(20, Number(config.count) || 1));
      const mode = config.mode === "windows" ? "windows" : "tabs";
      const isBrowser = targetApp.type === "browser" || /chrome|edge|coccoc|brave|firefox|opera/i.test(targetApp.name || targetApp.path);
      const isFirefox = /firefox/i.test(targetApp.name || targetApp.path);

      let urls = [];
      if (isBrowser) {
        try {
          urls = normalizeUrls(config.urls, count);
        } catch (e) {
          return { ok: false, error: e.message };
        }
      }

      let opened = 0;
      for (let i = 0; i < count; i++) {
        if (job.cancelled) break;
        let args = [];

        if (isBrowser) {
          const url = urls[i];
          const prefix = isFirefox ? (mode === "windows" ? "-new-window" : "-new-tab") : (mode === "windows" ? "--new-window" : "--new-tab");
          args = [prefix, url];
        } else if (config.customArgs) {
          args = String(config.customArgs).split(" ").filter(Boolean);
        }

        launchAppProcess(targetApp.path, args);
        opened++;
        sendProgress({
          type: "progress",
          opened,
          total: count,
          message: `Đã mở ${targetApp.name} (${opened}/${count})`
        });

        if (i < count - 1 && delayMs > 0) {
          await delay(delayMs);
        }
      }

      let layoutMessage = "";
      if (!job.cancelled && isBrowser && mode === "windows" && config.grid) {
        await delay(1500);
        const result = await arrangeWindows(targetApp.windowPattern || targetApp.name || "Chrome");
        layoutMessage = result.message;
      }

      const cancelled = job.cancelled;
      sendProgress({
        type: "done",
        opened,
        total: count,
        cancelled,
        message: cancelled
          ? `Đã dừng. Đã mở ${opened}/${count}.`
          : `Hoàn tất: đã gửi lệnh mở ${opened}/${count} ${targetApp.name}. ${layoutMessage}`.trim()
      });

      return { ok: true, opened, total: count, cancelled, message: layoutMessage };
    }
  } catch (e) {
    return { ok: false, error: e.message, opened: 0 };
  } finally {
    activeJob = null;
  }
});

ipcMain.handle("launcher:open-url", async (_event, url) => {
  if (typeof url !== "string" || !/^https?:\/\//i.test(url)) return { ok: false };
  await shell.openExternal(url);
  return { ok: true };
});

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});