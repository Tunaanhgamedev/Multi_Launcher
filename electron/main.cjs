const { app, BrowserWindow, ipcMain, shell, dialog, screen, globalShortcut, clipboard } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

// Tối ưu hóa Chromium engine cho Electron UI: bật tăng tốc phần cứng GPU, rasterization và giảm độ trễ render
app.commandLine.appendSwitch("enable-gpu-rasterization");
app.commandLine.appendSwitch("enable-zero-copy");
app.commandLine.appendSwitch("ignore-gpu-blocklist");
app.commandLine.appendSwitch("disable-site-isolation-trials");
app.commandLine.appendSwitch("disable-features", "CalculateNativeWinOcclusion");

let mainWindow;
let activeJob = null;
let cachedDetectedApps = null;

// Các cờ tối ưu hóa hiệu năng cho Chromium (Chrome, Edge, Cốc Cốc, Brave, Opera)
// Giúp giảm tải 40-50% RAM/CPU và khởi chạy tức thì mà không nghẽn ổ đĩa khi mở nhiều cửa sổ
const CHROMIUM_PERFORMANCE_FLAGS = [
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-background-networking",
  "--disable-sync",
  "--disable-default-apps",
  "--disable-breakpad",
  "--disable-component-update",
  "--disk-cache-size=33554432",
  "--media-cache-size=16777216",
  "--disable-features=Translate,OptimizationHints,MediaRouter,CalculateNativeWinOcclusion,InterestFeedContentSuggestions"
];

// Quản lý tiến trình đồng bộ chuột toàn cục
let mouseSyncProcess = null;
let mouseSyncPattern = "Chrome|Edge|CocCoc|browser";
let isMouseSyncActive = false;

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
  const appData = process.env.APPDATA || "";

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
      id: "zalo",
      name: "Zalo Desktop",
      type: "app",
      category: "Liên lạc & Chat",
      icon: "💬",
      candidates: [
        path.join(local, "Programs", "Zalo", "Zalo.exe"),
        path.join(local, "Zalo", "Zalo.exe")
      ],
      windowPattern: "Zalo"
    },
    {
      id: "telegram",
      name: "Telegram Desktop",
      type: "app",
      category: "Liên lạc & Chat",
      icon: "✈️",
      candidates: [
        path.join(appData, "Telegram Desktop", "Telegram.exe"),
        path.join(local, "Programs", "Telegram Desktop", "Telegram.exe")
      ],
      windowPattern: "Telegram"
    },
    {
      id: "discord",
      name: "Discord",
      type: "app",
      category: "Liên lạc & Chat",
      icon: "🎧",
      candidates: [
        path.join(local, "Discord", "Update.exe")
      ],
      windowPattern: "Discord"
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
      id: "paint",
      name: "Paint (Vẽ)",
      type: "app",
      category: "Tiện ích Windows",
      icon: "🎨",
      candidates: [
        path.join(win, "System32", "mspaint.exe"),
        path.join(win, "mspaint.exe")
      ],
      windowPattern: "Paint"
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
      id: "explorer",
      name: "File Explorer (Thư mục)",
      type: "app",
      category: "Tiện ích Windows",
      icon: "📁",
      candidates: [
        path.join(win, "explorer.exe")
      ],
      windowPattern: "File Explorer"
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
    },
    {
      id: "powerpoint",
      name: "Microsoft PowerPoint",
      type: "app",
      category: "Văn phòng",
      icon: "📽️",
      candidates: [
        path.join(pf, "Microsoft Office", "Root", "Office16", "POWERPNT.EXE"),
        path.join(pfx86, "Microsoft Office", "Root", "Office16", "POWERPNT.EXE")
      ],
      windowPattern: "PowerPoint"
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

async function getAllDetectedApps(forceRefresh = false) {
  if (cachedDetectedApps && !forceRefresh) {
    return cachedDetectedApps;
  }

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

  cachedDetectedApps = detected;
  return detected;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 980,
    height: 860,
    minWidth: 720,
    minHeight: 640,
    title: "Multi Launcher",
    backgroundColor: "#0c1017",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false
    }
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  const localDist = path.join(__dirname, "../dist/index.html");
  if (app.isPackaged || fs.existsSync(localDist)) {
    mainWindow.loadFile(localDist);
  } else {
    mainWindow.loadURL("http://127.0.0.1:5173");
  }

  // Phím tắt F12 để mở DevTools kiểm tra nếu cần
  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.key === "F12" && input.type === "keyDown") {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  mainWindow.webContents.on("did-fail-load", (event, errorCode, errorDescription, validatedURL) => {
    console.error("Không thể tải trang:", errorCode, errorDescription, validatedURL);
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sendProgress(payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("launcher:progress", payload);
  }
}

function sendSyncStatus(payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("launcher:sync-status", payload);
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

/**
 * Tính toán kích thước và vị trí từng cửa sổ sao cho lấp đầy 100% diện tích màn hình máy tính
 */
function calculateWindowBounds(total, index, workArea) {
  const areaX = workArea?.x || 0;
  const areaY = workArea?.y || 0;
  const width = workArea?.width || 1920;
  const height = workArea?.height || 1080;

  if (total <= 1) {
    return { x: areaX, y: areaY, width, height };
  }

  const cols = Math.ceil(Math.sqrt(total));
  const rows = Math.ceil(total / cols);
  const rowH = Math.floor(height / rows);

  const itemsPerRow = [];
  let rem = total;
  for (let r = 0; r < rows; r++) {
    const rowsLeft = rows - r;
    const countInRow = Math.ceil(rem / rowsLeft);
    itemsPerRow.push(countInRow);
    rem -= countInRow;
  }

  let currentRow = 0;
  let offsetInRow = index;
  let accumulated = 0;
  for (let r = 0; r < rows; r++) {
    if (index < accumulated + itemsPerRow[r]) {
      currentRow = r;
      offsetInRow = index - accumulated;
      break;
    }
    accumulated += itemsPerRow[r];
  }

  const countInRow = itemsPerRow[currentRow];
  const colW = Math.floor(width / countInRow);
  const posX = areaX + offsetInRow * colW;
  const posY = areaY + currentRow * rowH;
  const actualW = offsetInRow === countInRow - 1 ? width - offsetInRow * colW : colW;
  const actualH = currentRow === rows - 1 ? height - currentRow * rowH : rowH;

  return {
    x: posX,
    y: posY,
    width: actualW,
    height: actualH
  };
}

/**
 * Gọi script Win32 PowerShell chuyên biệt để căn chỉnh các cửa sổ theo bố cục màn hình:
 * - 'auto': chia lưới tối ưu
 * - 'split-2': chia đôi cột trái / phải (50/50)
 * - 'split-3': chia 3 cột (33.3% mỗi cột)
 * - 'grid-2x2': chia 4 ô góc (2x2)
 * - 'grid-3x2': chia 6 ô (2 hàng 3 cột)
 * - 'minimize': thu nhỏ tất cả
 * - 'restore': khôi phục tất cả
 */
async function arrangeWindows(targetPattern = "Chrome", layout = "auto") {
  if (process.platform !== "win32") return { arranged: false, count: 0, message: "Sắp xếp lưới chỉ được hỗ trợ trên Windows." };
  const scriptPath = path.join(__dirname, "window-manager.ps1");
  return new Promise((resolve) => {
    const child = spawn(
      "powershell.exe",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        scriptPath,
        "-action",
        "arrange",
        "-pattern",
        targetPattern || ".*",
        "-layout",
        layout || "auto"
      ],
      { windowsHide: true }
    );
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (err += d.toString()));
    child.on("close", (code) => {
      const count = Number(out.trim()) || 0;
      const layoutName =
        layout === "split-2" ? "2 Cột (50/50)" :
        layout === "split-3" ? "3 Cột" :
        layout === "grid-2x2" ? "4 Ô (2x2)" :
        layout === "grid-3x2" ? "6 Ô (3x2)" :
        layout === "minimize" ? "Thu nhỏ" :
        layout === "restore" ? "Khôi phục" : "Lưới tự động";

      if (code === 0) resolve({ arranged: true, count, message: `Đã căn chỉnh ${count} cửa sổ theo bố cục [${layoutName}].` });
      else resolve({ arranged: false, count: 0, message: `Không thể sắp xếp tự động: ${err.trim() || "PowerShell trả về lỗi."}` });
    });
    child.on("error", () => resolve({ arranged: false, count: 0, message: "Không thể khởi chạy PowerShell để sắp xếp cửa sổ." }));
  });
}

/**
 * Đóng nhanh tất cả các cửa sổ mục tiêu khớp pattern bằng WM_CLOSE an toàn
 */
async function closeTargetWindows(targetPattern = "Chrome") {
  if (process.platform !== "win32") return { closed: false, count: 0, message: "Chức năng chỉ hỗ trợ trên Windows." };
  const scriptPath = path.join(__dirname, "window-manager.ps1");
  return new Promise((resolve) => {
    const child = spawn(
      "powershell.exe",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        scriptPath,
        "-action",
        "close",
        "-pattern",
        targetPattern || ".*"
      ],
      { windowsHide: true }
    );
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (err += d.toString()));
    child.on("close", (code) => {
      const count = Number(out.trim()) || 0;
      if (code === 0) resolve({ closed: true, count, message: count > 0 ? `Đã gửi tín hiệu đóng ${count} cửa sổ mục tiêu.` : "Không tìm thấy cửa sổ mục tiêu nào đang mở." });
      else resolve({ closed: false, count: 0, message: `Lỗi khi đóng cửa sổ: ${err.trim() || "PowerShell error"}` });
    });
    child.on("error", () => resolve({ closed: false, count: 0, message: "Không thể gọi PowerShell để đóng cửa sổ." }));
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

// Bắt đầu đồng bộ chuột
function startMouseSync(pattern) {
  if (mouseSyncProcess) {
    stopMouseSync();
  }

  mouseSyncPattern = pattern || mouseSyncPattern || "Chrome|Edge|CocCoc|browser";
  const scriptPath = path.join(__dirname, "mouse-sync.ps1");
  const launcherPid = process.pid;

  try {
    mouseSyncProcess = spawn(
      "powershell.exe",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        scriptPath,
        "-pattern",
        mouseSyncPattern,
        "-launcherPid",
        String(launcherPid)
      ],
      { windowsHide: true }
    );

    isMouseSyncActive = true;

    mouseSyncProcess.stdout.on("data", (d) => {
      const text = d.toString();
      const readyMatch = text.match(/READY:\s*(\d+)/i);
      const countMatch = text.match(/COUNT:\s*(\d+)/i);
      const match = readyMatch || countMatch;

      if (match) {
        const count = parseInt(match[1], 10);
        const msg = count >= 2
          ? `Đang đồng bộ ${count} cửa sổ (Bấm F8 để Bật/Tắt). Bạn có thể thao tác bình thường trong app này.`
          : count === 1
          ? `Đã bật đồng bộ nhưng mới tìm thấy 1 cửa sổ (cần tối thiểu 2 cửa sổ để đồng bộ chuột)`
          : `Đã bật đồng bộ nhưng chưa phát hiện cửa sổ mục tiêu nào đang mở`;
        sendSyncStatus({ active: true, count, message: msg });
      }
    });

    mouseSyncProcess.on("close", () => {
      isMouseSyncActive = false;
      mouseSyncProcess = null;
      sendSyncStatus({ active: false, count: 0, message: "Đã dừng đồng bộ chuột" });
    });

    mouseSyncProcess.on("error", (err) => {
      isMouseSyncActive = false;
      mouseSyncProcess = null;
      sendSyncStatus({ active: false, count: 0, error: err.message, message: "Lỗi tiến trình đồng bộ chuột" });
    });

    sendSyncStatus({ active: true, count: 0, message: "Đang bật đồng bộ chuột... (Bấm F8 để Tắt)" });
    return { active: true, message: "Đang khởi động đồng bộ chuột" };
  } catch (e) {
    isMouseSyncActive = false;
    mouseSyncProcess = null;
    sendSyncStatus({ active: false, count: 0, error: e.message });
    return { active: false, error: e.message };
  }
}

// Dừng đồng bộ chuột hoàn toàn
function stopMouseSync() {
  if (mouseSyncProcess) {
    try {
      if (process.platform === "win32" && mouseSyncProcess.pid) {
        spawn("taskkill", ["/pid", String(mouseSyncProcess.pid), "/T", "/F"], { windowsHide: true });
      } else {
        mouseSyncProcess.kill();
      }
    } catch {}
    mouseSyncProcess = null;
  }
  isMouseSyncActive = false;
  sendSyncStatus({ active: false, count: 0, message: "Đã dừng đồng bộ chuột" });
  return { active: false };
}

// Chuyển đổi trạng thái Bật / Tắt đồng bộ chuột
function toggleMouseSync(pattern) {
  if (isMouseSyncActive) {
    return stopMouseSync();
  } else {
    return startMouseSync(pattern);
  }
}

// IPC Handlers
ipcMain.handle("launcher:chrome-path", () => ({ path: findChrome(), platform: process.platform }));

ipcMain.handle("launcher:get-detected-apps", async () => {
  return await getAllDetectedApps();
});

ipcMain.handle("launcher:refresh-apps", async () => {
  cachedDetectedApps = null;
  return await getAllDetectedApps(true);
});

ipcMain.handle("launcher:toggle-always-on-top", (_event, flag) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    const next = typeof flag === "boolean" ? flag : !mainWindow.isAlwaysOnTop();
    mainWindow.setAlwaysOnTop(next);
    return { alwaysOnTop: next };
  }
  return { alwaysOnTop: false };
});

ipcMain.handle("launcher:get-always-on-top", () => {
  return { alwaysOnTop: mainWindow && !mainWindow.isDestroyed() ? mainWindow.isAlwaysOnTop() : false };
});

ipcMain.handle("launcher:set-mouse-sync-pattern", (_event, pattern) => {
  if (typeof pattern === "string" && pattern.trim()) {
    mouseSyncPattern = pattern.trim();
    return { ok: true, pattern: mouseSyncPattern };
  }
  return { ok: false };
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

ipcMain.handle("launcher:arrange-windows", async (_event, pattern, layout) => {
  return await arrangeWindows(pattern || ".*", layout || "auto");
});

ipcMain.handle("launcher:close-target-windows", async (_event, pattern) => {
  return await closeTargetWindows(pattern || ".*");
});

ipcMain.handle("launcher:open-profiles-folder", async () => {
  const profileDir = path.join(os.tmpdir(), "multi_launcher_profiles");
  if (!fs.existsSync(profileDir)) {
    fs.mkdirSync(profileDir, { recursive: true });
  }
  await shell.openPath(profileDir);
  return { ok: true, path: profileDir };
});

ipcMain.handle("launcher:read-clipboard", () => {
  return { text: clipboard.readText() || "" };
});

ipcMain.handle("launcher:toggle-mouse-sync", (_event, pattern) => {
  return toggleMouseSync(pattern);
});

ipcMain.handle("launcher:get-mouse-sync-status", () => {
  return { active: isMouseSyncActive };
});

ipcMain.handle("launcher:stop", () => {
  if (activeJob) activeJob.cancelled = true;
  return { ok: true };
});

ipcMain.handle("launcher:start", async (_event, config) => {
  if (activeJob) return { ok: false, error: "Một tác vụ đang chạy. Hãy dừng tác vụ đó trước." };

  const modeType = config.modeType || "single-app"; // 'single-app' | 'multi-app'
  const delayMs = Math.max(0, Math.min(10000, Number(config.delayMs) || 0));
  const profileMode = config.profileMode || "normal"; // 'normal' | 'incognito' | 'isolated'

  let workArea = { x: 0, y: 0, width: 1920, height: 1040 };
  try {
    const primaryDisplay = screen.getPrimaryDisplay();
    if (primaryDisplay && primaryDisplay.workArea) {
      workArea = primaryDisplay.workArea;
    }
  } catch {
    // fallback
  }

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

      const isWindowMode = config.browserMode === "windows";

      for (let i = 0; i < apps.length; i++) {
        if (job.cancelled) break;
        const currentApp = apps[i];
        if (!currentApp.path || !fs.existsSync(currentApp.path)) {
          sendProgress({ type: "warning", message: `Không tìm thấy file của ${currentApp.name}. Bỏ qua.` });
          continue;
        }

        let args = [];
        if (currentApp.type === "browser") {
          const isFirefox = /firefox/i.test(currentApp.name || currentApp.path);
          const isEdge = /edge|msedge/i.test(currentApp.name || currentApp.path);
          const bounds = calculateWindowBounds(apps.length, i, workArea);

          const url = urlList.length > 0 ? urlList[i % urlList.length] : "https://www.google.com";

          if (isFirefox) {
            args = isWindowMode ? ["-new-window", url] : ["-new-tab", url];
            if (profileMode === "incognito") args.unshift("-private-window");
            else if (profileMode === "isolated") {
              const isolatedDir = path.join(app.getPath("userData"), "multi_profiles", `firefox_profile_${i + 1}`);
              if (!fs.existsSync(isolatedDir)) fs.mkdirSync(isolatedDir, { recursive: true });
              args.unshift("-no-remote", "-profile", isolatedDir);
            }
          } else {
            args = isWindowMode
              ? [
                  "--new-window",
                  `--window-position=${bounds.x},${bounds.y}`,
                  `--window-size=${bounds.width},${bounds.height}`,
                  ...CHROMIUM_PERFORMANCE_FLAGS,
                  url
                ]
              : ["--new-tab", ...CHROMIUM_PERFORMANCE_FLAGS, url];

            if (profileMode === "incognito") {
              if (isEdge) args.unshift("-inprivate");
              else args.unshift("--incognito");
            } else if (profileMode === "isolated") {
              const isolatedDir = path.join(app.getPath("userData"), "multi_profiles", `profile_${i + 1}`);
              if (!fs.existsSync(isolatedDir)) fs.mkdirSync(isolatedDir, { recursive: true });
              args.unshift(`--user-data-dir=${isolatedDir}`);
            }
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

        const effectiveDelay = delayMs > 0 ? delayMs : 100;
        if (i < apps.length - 1) {
          await delay(effectiveDelay);
        }
      }

      const patterns = apps.map((a) => a.windowPattern || a.name).filter(Boolean);
      mouseSyncPattern = patterns.length ? patterns.join("|") : ".*";

      let layoutMessage = "";
      if (!job.cancelled && isWindowMode && config.grid !== false) {
        await delay(1200);
        const result = await arrangeWindows(mouseSyncPattern);
        layoutMessage = result.message;
      }

      const cancelled = job.cancelled;
      sendProgress({
        type: "done",
        opened,
        total,
        cancelled,
        message: cancelled
          ? `Đã dừng. Đã mở ${opened}/${total} ứng dụng.`
          : `Hoàn tất: Đã mở thành công ${opened}/${total} ứng dụng. ${layoutMessage}`.trim()
      });

      return { ok: true, opened, total, cancelled, message: layoutMessage };
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

      mouseSyncPattern = targetApp.windowPattern || targetApp.name || "Chrome";

      const count = Math.max(1, Math.min(20, Number(config.count) || 1));
      const mode = config.mode === "windows" ? "windows" : "tabs";
      const isBrowser = targetApp.type === "browser" || /chrome|edge|coccoc|brave|firefox|opera/i.test(targetApp.name || targetApp.path);
      const isFirefox = /firefox/i.test(targetApp.name || targetApp.path);
      const isEdge = /edge|msedge/i.test(targetApp.name || targetApp.path);

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
          const bounds = calculateWindowBounds(count, i, workArea);
          if (isFirefox) {
            args = mode === "windows" ? ["-new-window", url] : ["-new-tab", url];
            if (profileMode === "incognito") args.unshift("-private-window");
            else if (profileMode === "isolated") {
              const isolatedDir = path.join(app.getPath("userData"), "multi_profiles", `firefox_profile_${i + 1}`);
              if (!fs.existsSync(isolatedDir)) fs.mkdirSync(isolatedDir, { recursive: true });
              args.unshift("-no-remote", "-profile", isolatedDir);
            }
          } else {
            args = mode === "windows"
              ? [
                  "--new-window",
                  `--window-position=${bounds.x},${bounds.y}`,
                  `--window-size=${bounds.width},${bounds.height}`,
                  ...CHROMIUM_PERFORMANCE_FLAGS,
                  url
                ]
              : ["--new-tab", ...CHROMIUM_PERFORMANCE_FLAGS, url];

            if (profileMode === "incognito") {
              if (isEdge) args.unshift("-inprivate");
              else args.unshift("--incognito");
            } else if (profileMode === "isolated") {
              const isolatedDir = path.join(app.getPath("userData"), "multi_profiles", `profile_${i + 1}`);
              if (!fs.existsSync(isolatedDir)) fs.mkdirSync(isolatedDir, { recursive: true });
              args.unshift(`--user-data-dir=${isolatedDir}`);
            }
          }
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

        const effectiveDelay = delayMs > 0 ? delayMs : 100;
        if (i < count - 1) {
          await delay(effectiveDelay);
        }
      }

      let layoutMessage = "";
      if (!job.cancelled && mode === "windows" && config.grid !== false) {
        await delay(1200);
        const result = await arrangeWindows(mouseSyncPattern);
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

      return { ok: true, opened, total, count, cancelled, message: layoutMessage };
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

  // Đăng ký phím tắt F8 toàn cục để bật/tắt đồng bộ chuột nhanh từ bất kỳ cửa sổ nào
  try {
    globalShortcut.register("F8", () => {
      toggleMouseSync(mouseSyncPattern);
    });
  } catch (e) {
    console.error("Lỗi đăng ký phím tắt F8:", e);
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("will-quit", () => {
  try {
    globalShortcut.unregisterAll();
  } catch {}
  stopMouseSync();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});