import { useEffect, useState, useMemo, useCallback, useRef, memo } from "react";

const DEFAULT_URLS = "https://www.google.com";
const STORAGE_KEY_CUSTOM_APPS = "multi_launcher_custom_apps";
const STORAGE_KEY_PRESETS = "multi_launcher_saved_presets";

const BUILTIN_PRESETS = [
  {
    id: "work",
    name: "💼 Không gian làm việc",
    desc: "Mở cùng lúc Chrome, VS Code, Notepad & Zalo",
    workflow: "multi",
    appIds: ["chrome", "vscode", "notepad", "zalo"],
    mode: "windows",
    grid: true,
    urls: "https://mail.google.com\nhttps://github.com"
  },
  {
    id: "quad-browsers",
    name: "🌐 4 Cửa sổ chia góc",
    desc: "4 cửa sổ trình duyệt tự chia đều 4 góc màn hình",
    workflow: "single",
    targetId: "chrome",
    count: 4,
    mode: "windows",
    grid: true,
    profileMode: "normal",
    urls: "https://www.google.com\nhttps://www.youtube.com\nhttps://github.com\nhttps://reddit.com"
  },
  {
    id: "mmo-isolated",
    name: "🎮 Đa tài khoản độc lập (MMO/Profile)",
    desc: "4 cửa sổ Chrome với Profile & Cookie tách biệt hoàn toàn",
    workflow: "single",
    targetId: "chrome",
    count: 4,
    mode: "windows",
    grid: true,
    profileMode: "isolated",
    urls: "https://www.google.com"
  }
];

/**
 * Thẻ ứng dụng được Memo hóa để tránh render lại toàn bộ danh sách khi tiến trình cập nhật
 */
const AppCard = memo(function AppCard({
  appItem,
  isSelected,
  workflow,
  running,
  onSelect,
  onDeleteCustom
}) {
  return (
    <div
      className={`app-card ${isSelected ? "selected" : ""} ${!appItem.available ? "unavailable" : ""}`}
      onClick={() => {
        if (!appItem.available || running) return;
        onSelect(appItem.id);
      }}
    >
      <div className="app-card-header">
        <span className="app-icon">{appItem.icon || "📦"}</span>
        <div className="app-meta">
          <strong className="app-title">{appItem.name}</strong>
          <span className="app-category">{appItem.category}</span>
        </div>

        {appItem.isCustom && (
          <button
            className="delete-custom-btn"
            title="Xóa ứng dụng này khỏi danh sách"
            onClick={(e) => onDeleteCustom(e, appItem.id)}
          >
            ✕
          </button>
        )}
      </div>

      <div className="app-card-footer">
        <span className={`status-badge ${appItem.available ? "ready" : "missing"}`}>
          {appItem.available ? "Sẵn sàng" : "Chưa cài đặt"}
        </span>

        <span className="card-selector">
          {workflow === "multi" ? (
            <input
              type="checkbox"
              checked={isSelected}
              disabled={!appItem.available || running}
              onChange={() => {}}
            />
          ) : (
            <input
              type="radio"
              checked={isSelected}
              disabled={!appItem.available || running}
              onChange={() => {}}
            />
          )}
        </span>
      </div>
    </div>
  );
});

export default function App() {
  const [workflow, setWorkflow] = useState("multi"); // "multi": Tổ hợp nhiều app, "single": Hàng loạt 1 app
  const [apps, setApps] = useState([]);
  const [selectedAppIds, setSelectedAppIds] = useState(new Set());
  const [targetAppId, setTargetAppId] = useState("");
  const currentTargetApp = useMemo(() => apps.find((a) => a.id === targetAppId), [apps, targetAppId]);
  
  // Bộ lọc & Tìm kiếm
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Cấu hình mở
  const [mode, setMode] = useState("windows"); // 'windows' | 'tabs'
  const [count, setCount] = useState(4);
  const [delayMs, setDelayMs] = useState(1000);
  const [urls, setUrls] = useState(DEFAULT_URLS);
  const [grid, setGrid] = useState(true);
  const [profileMode, setProfileMode] = useState("normal"); // 'normal' | 'incognito' | 'isolated'

  // Ghim cửa sổ Always on Top
  const [alwaysOnTop, setAlwaysOnTop] = useState(false);

  // Đồng bộ chuột
  const [syncActive, setSyncActive] = useState(false);
  const [syncCount, setSyncCount] = useState(0);

  // Kịch bản tùy chỉnh của người dùng
  const [customPresets, setCustomPresets] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_PRESETS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [showSavePresetModal, setShowSavePresetModal] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");
  const [newPresetIcon, setNewPresetIcon] = useState("⚡");

  // Quản lý combo tác vụ và pattern
  const pendingComboRef = useRef(null);
  const targetPatternRef = useRef("Chrome|Edge|CocCoc|Brave|Firefox");

  // Tiến trình & Trạng thái
  const [running, setRunning] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState("Sẵn sàng. Hãy chọn ứng dụng và nhấn bắt đầu.");
  const [progress, setProgress] = useState({ opened: 0, total: 0 });
  const [error, setError] = useState("");

  // Tải danh sách ứng dụng đã cài đặt và ứng dụng tùy chọn
  const loadApps = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const detected = isRefresh && window.launcher.refreshApps
        ? await window.launcher.refreshApps()
        : await window.launcher.getDetectedApps();

      const savedCustomRaw = localStorage.getItem(STORAGE_KEY_CUSTOM_APPS);
      let customApps = [];
      if (savedCustomRaw) {
        try {
          customApps = JSON.parse(savedCustomRaw);
        } catch {
          customApps = [];
        }
      }

      const combined = [...detected, ...customApps];
      setApps(combined);

      // Nếu chưa có targetAppId, chọn app khả dụng đầu tiên
      setTargetAppId((prev) => {
        if (prev) return prev;
        const firstAvailable = combined.find((a) => a.available);
        return firstAvailable ? firstAvailable.id : "";
      });

      // Nếu selectedAppIds rỗng, chọn mặc định
      setSelectedAppIds((prev) => {
        if (prev && prev.size > 0) return prev;
        const defaultMulti = combined.filter((a) => a.available && ["chrome", "edge", "coccoc", "vscode", "notepad"].includes(a.id));
        if (defaultMulti.length > 0) {
          return new Set(defaultMulti.map((a) => a.id));
        }
        const firstAvail = combined.find((a) => a.available);
        return firstAvail ? new Set([firstAvail.id]) : new Set();
      });

      if (isRefresh) {
        setStatus(`Đã làm mới: Nhận diện thành công ${combined.filter((a) => a.available).length} ứng dụng.`);
      }
    } catch (err) {
      setError("Không thể tải danh sách ứng dụng: " + err.message);
    } finally {
      if (isRefresh) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadApps(false);

    // Khởi tạo trạng thái Always on Top
    if (window.launcher.getAlwaysOnTop) {
      window.launcher.getAlwaysOnTop().then((res) => {
        if (res && res.alwaysOnTop) setAlwaysOnTop(true);
      });
    }

    // Khởi tạo trạng thái đồng bộ chuột ban đầu
    if (window.launcher.getMouseSyncStatus) {
      window.launcher.getMouseSyncStatus().then((res) => {
        if (res && res.active) setSyncActive(true);
      });
    }

    const unsubProgress = window.launcher.onProgress((event) => {
      if (event.type === "progress") {
        setProgress({ opened: event.opened, total: event.total });
        setStatus(event.message);
      } else if (event.type === "done") {
        setRunning(false);
        setProgress({ opened: event.opened, total: event.total });
        setStatus(event.message);

        // Kích hoạt Combo tác vụ nếu có yêu cầu
        if (pendingComboRef.current) {
          const combo = pendingComboRef.current;
          pendingComboRef.current = null;
          const pattern = targetPatternRef.current;

          setTimeout(async () => {
            if (combo.autoArrange && window.launcher.arrangeWindows) {
              await window.launcher.arrangeWindows(pattern, combo.layout || "auto");
            }
            if (combo.autoSync && window.launcher.toggleMouseSync) {
              const res = await window.launcher.toggleMouseSync(pattern);
              if (res && res.active) setSyncActive(true);
            }
          }, 600);
        }
      } else if (event.type === "warning") {
        setStatus(event.message);
      }
    });

    const unsubSync = window.launcher.onMouseSyncStatus ? window.launcher.onMouseSyncStatus((payload) => {
      setSyncActive(payload.active);
      if (payload.count !== undefined) setSyncCount(payload.count);
      if (payload.message) setStatus(payload.message);
    }) : () => {};

    return () => {
      unsubProgress();
      unsubSync();
    };
  }, [loadApps]);

  // Lắng nghe phím tắt Escape để dừng nếu đang chạy
  useEffect(() => {
    if (!running) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        handleStop();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [running]);

  // Lấy mẫu tên cửa sổ của ứng dụng đang chọn
  const getTargetPattern = useCallback(() => {
    const defaultPattern = "Chrome|Edge|CocCoc|Brave|Firefox";
    const selectedNames = apps
      .filter((a) => selectedAppIds.has(a.id))
      .map((a) => a.windowPattern || a.name)
      .filter(Boolean);
    return workflow === "single"
      ? (currentTargetApp?.windowPattern || currentTargetApp?.name || defaultPattern)
      : (selectedNames.length ? selectedNames.join("|") : defaultPattern);
  }, [apps, selectedAppIds, workflow, currentTargetApp]);

  // Cập nhật targetPattern cho backend mỗi khi chọn ứng dụng
  useEffect(() => {
    const pattern = getTargetPattern();
    targetPatternRef.current = pattern;
    if (window.launcher.setMouseSyncPattern) {
      window.launcher.setMouseSyncPattern(pattern);
    }
  }, [getTargetPattern]);

  // Lọc danh mục & tìm kiếm ứng dụng
  const filteredApps = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return apps.filter((app) => {
      const matchCat =
        categoryFilter === "all" ? true :
        categoryFilter === "available" ? app.available :
        categoryFilter === "browser" ? app.type === "browser" :
        categoryFilter === "custom" ? app.isCustom :
        categoryFilter === "system" ? !app.isCustom && app.type !== "browser" : true;

      if (!matchCat) return false;
      if (!query) return true;
      return (
        app.name.toLowerCase().includes(query) ||
        (app.category && app.category.toLowerCase().includes(query)) ||
        (app.path && app.path.toLowerCase().includes(query))
      );
    });
  }, [apps, categoryFilter, searchQuery]);

  // Bật / Tắt Ghim trên cùng
  async function handleToggleAlwaysOnTop() {
    try {
      const res = await window.launcher.toggleAlwaysOnTop();
      setAlwaysOnTop(res.alwaysOnTop);
      setStatus(res.alwaysOnTop ? "📌 Đã ghim cửa sổ Multi Launcher luôn hiển thị trên cùng." : "Đã bỏ ghim cửa sổ.");
    } catch (e) {
      setError("Không thể chuyển đổi ghim cửa sổ: " + e.message);
    }
  }

  // Thêm ứng dụng tùy chọn từ máy
  async function handleBrowseApp() {
    setError("");
    try {
      const res = await window.launcher.browseApp();
      if (res.canceled || !res.app) return;

      const newApp = res.app;
      const updatedApps = [...apps.filter((a) => a.path !== newApp.path), newApp];
      setApps(updatedApps);

      const customOnly = updatedApps.filter((a) => a.isCustom);
      localStorage.setItem(STORAGE_KEY_CUSTOM_APPS, JSON.stringify(customOnly));

      if (workflow === "single") {
        setTargetAppId(newApp.id);
      } else {
        setSelectedAppIds((prev) => new Set([...prev, newApp.id]));
      }

      setStatus(`Đã thêm ứng dụng: ${newApp.name}`);
    } catch (e) {
      setError("Lỗi khi chọn ứng dụng: " + e.message);
    }
  }

  // Xóa ứng dụng tự thêm
  const handleDeleteCustomApp = useCallback((e, appId) => {
    e.stopPropagation();
    setApps((prevApps) => {
      const updated = prevApps.filter((a) => a.id !== appId);
      const customOnly = updated.filter((a) => a.isCustom);
      localStorage.setItem(STORAGE_KEY_CUSTOM_APPS, JSON.stringify(customOnly));
      return updated;
    });

    setSelectedAppIds((prev) => {
      const next = new Set(prev);
      next.delete(appId);
      return next;
    });

    setTargetAppId((prev) => {
      if (prev === appId) {
        return "";
      }
      return prev;
    });
  }, []);

  // Chọn/bỏ chọn app trong chế độ Multi
  const toggleAppSelection = useCallback((appId) => {
    setSelectedAppIds((prev) => {
      const next = new Set(prev);
      if (next.has(appId)) next.delete(appId);
      else next.add(appId);
      return next;
    });
  }, []);

  // Xử lý chọn card ứng dụng (hỗ trợ cả multi và single)
  const handleCardSelect = useCallback((appId) => {
    if (workflow === "multi") {
      toggleAppSelection(appId);
    } else {
      setTargetAppId(appId);
    }
  }, [workflow, toggleAppSelection]);

  function handleSelectAll() {
    const availableIds = filteredApps.filter((a) => a.available).map((a) => a.id);
    setSelectedAppIds(new Set(availableIds));
  }

  function handleDeselectAll() {
    setSelectedAppIds(new Set());
  }

  // Bật / Tắt đồng bộ chuột
  async function handleToggleSync() {
    setError("");
    try {
      const targetPattern = targetPatternRef.current || getTargetPattern();
      const res = await window.launcher.toggleMouseSync(targetPattern);
      setSyncActive(res.active);
    } catch (e) {
      setError("Lỗi khi chuyển đổi đồng bộ chuột: " + e.message);
    }
  }

  // Căn chỉnh cửa sổ theo bố cục cụ thể
  async function handleArrangeWithLayout(layout = "auto") {
    setError("");
    const targetPattern = targetPatternRef.current || getTargetPattern();
    const layoutNames = {
      "auto": "Lưới tự động",
      "split-2": "2 Cột (50/50)",
      "split-3": "3 Cột",
      "grid-2x2": "4 Ô (2x2)",
      "grid-3x2": "6 Ô (3x2)",
      "minimize": "Thu nhỏ",
      "restore": "Khôi phục"
    };
    setStatus(`Đang căn chỉnh các cửa sổ theo bố cục [${layoutNames[layout] || layout}]...`);
    try {
      const res = await window.launcher.arrangeWindows(targetPattern, layout);
      if (res.arranged) {
        setStatus(res.message || "Đã căn chỉnh các cửa sổ thành công.");
      } else {
        setError(res.message || "Không thể sắp xếp cửa sổ.");
      }
    } catch (e) {
      setError("Lỗi khi căn chỉnh cửa sổ: " + e.message);
    }
  }

  // Căn chỉnh ngay các cửa sổ trên màn hình (mặc định auto)
  async function handleArrangeNow() {
    await handleArrangeWithLayout("auto");
  }

  // Đóng toàn bộ cửa sổ mục tiêu đang mở
  async function handleCloseAllTarget() {
    setError("");
    const pattern = targetPatternRef.current || getTargetPattern();
    setStatus("Đang gửi yêu cầu đóng các cửa sổ mục tiêu...");
    try {
      const res = await window.launcher.closeTargetWindows(pattern);
      if (res.closed) {
        setStatus(res.message);
      } else {
        setError(res.message);
      }
    } catch (e) {
      setError("Lỗi khi đóng cửa sổ: " + e.message);
    }
  }

  // Mở thư mục chứa Profile người dùng
  async function handleOpenProfilesFolder() {
    try {
      await window.launcher.openProfilesFolder();
      setStatus("Đã mở thư mục lưu trữ profile độc lập.");
    } catch (e) {
      setError("Không thể mở thư mục: " + e.message);
    }
  }

  // Dán nội dung link từ Clipboard
  async function handlePasteClipboard() {
    try {
      const res = await window.launcher.readClipboard();
      if (!res.text || !res.text.trim()) {
        setStatus("Clipboard hiện đang trống.");
        return;
      }
      const text = res.text.trim();
      setUrls((prev) => (prev && prev.trim() ? `${prev.trim()}\n${text}` : text));
      setStatus("Đã dán liên kết từ clipboard vào danh sách URL.");
    } catch (e) {
      setError("Không thể đọc clipboard: " + e.message);
    }
  }

  // Đảo vùng chọn ứng dụng
  function handleInvertSelection() {
    const available = filteredApps.filter((a) => a.available).map((a) => a.id);
    setSelectedAppIds((prev) => {
      const next = new Set();
      available.forEach((id) => {
        if (!prev.has(id)) next.add(id);
      });
      return next;
    });
  }

  // Chỉ tích chọn các trình duyệt
  function handleSelectOnlyBrowsers() {
    const browserIds = apps.filter((a) => a.available && a.type === "browser").map((a) => a.id);
    setSelectedAppIds(new Set(browserIds));
    setStatus(`Đã chọn nhanh ${browserIds.length} trình duyệt có sẵn.`);
  }

  // Lưu cấu hình hiện tại thành Preset
  function handleSavePreset() {
    if (!newPresetName.trim()) {
      setError("Vui lòng nhập tên cho kịch bản.");
      return;
    }
    const newPreset = {
      id: "custom-preset-" + Date.now(),
      name: `${newPresetIcon} ${newPresetName.trim()}`,
      desc: workflow === "multi" ? `Tổ hợp ${selectedAppIds.size} ứng dụng` : `Nhân bản ${count} cửa sổ ${currentTargetApp?.name || ""}`,
      workflow,
      appIds: workflow === "multi" ? Array.from(selectedAppIds) : undefined,
      targetId: workflow === "single" ? targetAppId : undefined,
      count,
      mode,
      grid,
      profileMode,
      urls,
      isCustom: true
    };
    const updated = [...customPresets, newPreset];
    setCustomPresets(updated);
    localStorage.setItem(STORAGE_KEY_PRESETS, JSON.stringify(updated));
    setShowSavePresetModal(false);
    setNewPresetName("");
    setStatus(`Đã lưu kịch bản mới: ${newPreset.name}`);
  }

  // Xóa Preset người dùng
  function handleDeletePreset(e, id) {
    e.stopPropagation();
    const updated = customPresets.filter((p) => p.id !== id);
    setCustomPresets(updated);
    localStorage.setItem(STORAGE_KEY_PRESETS, JSON.stringify(updated));
    setStatus("Đã xóa kịch bản tùy chỉnh.");
  }

  // Áp dụng Preset
  function applyPreset(p) {
    setError("");
    setWorkflow(p.workflow);
    if (p.mode) setMode(p.mode);
    if (p.grid !== undefined) setGrid(p.grid);
    if (p.urls) setUrls(p.urls);
    if (p.count) setCount(p.count);
    if (p.profileMode) setProfileMode(p.profileMode);

    if (p.workflow === "single" && p.targetId) {
      const found = apps.find((a) => a.id === p.targetId && a.available) || apps.find((a) => a.available);
      if (found) setTargetAppId(found.id);
    } else if (p.workflow === "multi" && p.appIds) {
      const validIds = p.appIds.filter((id) => apps.some((a) => a.id === id && a.available));
      if (validIds.length) setSelectedAppIds(new Set(validIds));
    }
    setStatus(`Đã tải kịch bản: ${p.name}`);
  }

  // Combo: Chạy và tự chia lưới
  async function handleComboLaunchAndGrid() {
    await handleStart({ autoArrange: true, autoSync: false });
  }

  // Combo: Chạy, chia lưới và kích hoạt Sync chuột
  async function handleComboLaunchAndSync() {
    await handleStart({ autoArrange: true, autoSync: true });
  }

  // Bắt đầu khởi chạy
  async function handleStart(comboOptions = null) {
    setError("");
    setRunning(true);
    if (comboOptions) {
      pendingComboRef.current = comboOptions;
    } else {
      pendingComboRef.current = null;
    }

    if (workflow === "multi") {
      const chosenApps = apps.filter((a) => selectedAppIds.has(a.id) && a.available);
      if (!chosenApps.length) {
        setError("Vui lòng tích chọn ít nhất một ứng dụng có sẵn trên máy.");
        setRunning(false);
        return;
      }

      setProgress({ opened: 0, total: chosenApps.length });
      setStatus(`Bắt đầu mở ${chosenApps.length} ứng dụng...`);

      const result = await window.launcher.start({
        modeType: "multi-app",
        selectedApps: chosenApps,
        delayMs,
        urls,
        browserMode: mode,
        grid: comboOptions?.autoArrange ? true : grid,
        profileMode
      });

      if (!result.ok) {
        setError(result.error || "Không thể khởi chạy ứng dụng.");
        setStatus("Có lỗi xảy ra.");
        setRunning(false);
      }
    } else {
      const chosenApp = apps.find((a) => a.id === targetAppId);
      if (!chosenApp || !chosenApp.available) {
        setError("Vui lòng chọn một ứng dụng đã cài đặt trên máy.");
        setRunning(false);
        return;
      }

      setProgress({ opened: 0, total: count });
      setStatus(`Đang mở ${chosenApp.name}...`);

      const result = await window.launcher.start({
        modeType: "single-app",
        targetApp: chosenApp,
        count,
        delayMs,
        urls,
        mode,
        grid: comboOptions?.autoArrange ? true : grid,
        profileMode
      });

      if (!result.ok) {
        setError(result.error || "Không thể khởi chạy.");
        setStatus("Có lỗi xảy ra.");
        setRunning(false);
      }
    }
  }

  async function handleStop() {
    await window.launcher.stop();
    setStatus("Đang dừng tác vụ...");
  }

  const selectedCount = selectedAppIds.size;
  const percent = progress.total ? Math.min(100, Math.round((progress.opened / progress.total) * 100)) : 0;
  const availableCount = apps.filter((a) => a.available).length;
  const isTargetBrowser = currentTargetApp?.type === "browser";

  return (
    <main className="shell">
      {/* Top Header */}
      <header className="topbar">
        <div className="brand-icon">ML</div>
        <div>
          <p className="eyebrow">WINDOWS MULTI-APP LAUNCHER PRO</p>
          <h1>Multi Launcher</h1>
          <p className="subtitle">Khởi chạy đa ứng dụng • Tự chia lưới màn hình • Đồng bộ chuột F8</p>
        </div>
        <div className="topbar-pills">
          <button
            type="button"
            className={`pill pin-pill ${alwaysOnTop ? "pin-active" : ""}`}
            onClick={handleToggleAlwaysOnTop}
            title="Ghim cửa sổ Multi Launcher luôn hiển thị trên cùng để dễ điều khiển"
          >
            {alwaysOnTop ? "📌 Đã ghim trên cùng" : "📍 Ghim trên cùng"}
          </button>

          <span
            className={`pill ${syncActive ? "pill-active" : ""}`}
            onClick={handleToggleSync}
            style={{ cursor: "pointer" }}
            title="Bấm để Bật/Tắt nhanh đồng bộ chuột (Phím tắt: F8)"
          >
            {syncActive ? `🟢 Đang đồng bộ (${syncCount} tab)` : "⚪ Chuột độc lập (F8)"}
          </span>

          <button
            type="button"
            className="pill action-pill"
            onClick={handleCloseAllTarget}
            title="Đóng sạch tất cả các cửa sổ mục tiêu đang mở để dọn workspace"
          >
            🛑 Đóng nhanh tab
          </button>

          <button
            type="button"
            className="pill action-pill"
            onClick={handleOpenProfilesFolder}
            title="Mở thư mục lưu trữ profile độc lập (%TEMP%/multi_launcher_profiles)"
          >
            📁 Thư mục Profiles
          </button>

          <span className="pill ok" title="Số lượng ứng dụng đã được tự động phát hiện trên máy tính">
            {availableCount} ứng dụng sẵn sàng
          </span>
        </div>
      </header>

      {/* Kịch bản mẫu (Presets) */}
      <section className="presets-bar">
        <div className="presets-header">
          <span className="preset-label">⚡ Kịch bản nhanh (Presets):</span>
          <button
            type="button"
            className="save-preset-btn"
            onClick={() => setShowSavePresetModal(true)}
            disabled={running}
            title="Lưu cấu hình hiện tại thành kịch bản của riêng bạn"
          >
            💾 + Lưu kịch bản hiện tại
          </button>
        </div>

        <div className="preset-chips">
          {BUILTIN_PRESETS.map((p) => (
            <button
              key={p.id}
              className="preset-btn"
              onClick={() => applyPreset(p)}
              disabled={running}
              title={p.desc}
            >
              {p.name}
            </button>
          ))}
          {customPresets.map((p) => (
            <div key={p.id} className="preset-chip-wrapper">
              <button
                key={p.id}
                className="preset-btn custom-preset-btn"
                onClick={() => applyPreset(p)}
                disabled={running}
                title={p.desc}
              >
                {p.name}
              </button>
              <button
                type="button"
                className="delete-preset-chip"
                onClick={(e) => handleDeletePreset(e, p.id)}
                title="Xóa kịch bản tùy chỉnh này"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Thanh Tác Vụ Kết Hợp Nhanh (Quick Combos) */}
      <section className="combos-bar">
        <div className="combo-group">
          <span className="combo-title">⚡ Tác vụ kết hợp nhanh:</span>
          <button
            type="button"
            className="combo-btn run-grid-btn"
            onClick={handleComboLaunchAndGrid}
            disabled={running || (workflow === "multi" ? selectedCount === 0 : !currentTargetApp?.available)}
            title="Mở ứng dụng và tự động chia lưới vừa khít màn hình ngay khi hoàn thành"
          >
            🚀 Chạy & Chia Lưới
          </button>

          <button
            type="button"
            className="combo-btn run-sync-btn"
            onClick={handleComboLaunchAndSync}
            disabled={running || (workflow === "multi" ? selectedCount === 0 : !currentTargetApp?.available)}
            title="Mở ứng dụng, tự động chia lưới và BẬT ngay tính năng đồng bộ chuột F8"
          >
            🎯 Chạy & Bật Sync F8
          </button>

          <button
            type="button"
            className="combo-btn close-all-btn"
            onClick={handleCloseAllTarget}
            disabled={running}
            title="Đóng toàn bộ các cửa sổ của ứng dụng mục tiêu đang mở để dọn dẹp"
          >
            🛑 Đóng sạch cửa sổ
          </button>

          <button
            type="button"
            className="combo-btn paste-btn"
            onClick={handlePasteClipboard}
            disabled={running}
            title="Đọc nhanh danh sách link từ Clipboard và dán vào ô URL"
          >
            📋 Dán URL Clipboard
          </button>
        </div>
      </section>

      {/* Bước 1: Chọn Chế độ hoạt động */}
      <section className="panel">
        <div className="section-heading">
          <div>
            <span className="step">01</span>
            <h2>Chế độ khởi chạy</h2>
          </div>
          <span className="muted">Chọn cách bạn muốn mở ứng dụng</span>
        </div>

        <div className="workflow-toggle">
          <button
            className={`workflow-btn ${workflow === "multi" ? "active" : ""}`}
            onClick={() => setWorkflow("multi")}
            disabled={running}
          >
            <span className="workflow-icon">⊞</span>
            <div>
              <strong>Mở tổ hợp nhiều ứng dụng (Workspace)</strong>
              <small>Tích chọn nhiều phần mềm khác nhau (Chrome, Edge, VS Code, Zalo, Notepad...) và mở cùng lúc chỉ với 1 click.</small>
            </div>
          </button>

          <button
            className={`workflow-btn ${workflow === "single" ? "active" : ""}`}
            onClick={() => setWorkflow("single")}
            disabled={running}
          >
            <span className="workflow-icon">▤</span>
            <div>
              <strong>Mở hàng loạt 1 ứng dụng (Batch / URLs)</strong>
              <small>Nhân bản nhiều cửa sổ hoặc tab của một ứng dụng duy nhất kèm danh sách URL và đồng bộ thao tác.</small>
            </div>
          </button>
        </div>
      </section>

      {/* Bước 2: Danh sách ứng dụng */}
      <section className="panel">
        <div className="section-heading">
          <div>
            <span className="step">02</span>
            <h2>
              {workflow === "multi"
                ? `Chọn các ứng dụng cần mở (${selectedCount} đã chọn)`
                : `Chọn ứng dụng mục tiêu: ${currentTargetApp ? currentTargetApp.name : "Chưa chọn"}`}
            </h2>
          </div>

          <div className="app-actions-top">
            <button
              className="refresh-btn"
              onClick={() => loadApps(true)}
              disabled={running || refreshing}
              title="Quét lại toàn bộ các ứng dụng đã cài đặt trên máy"
            >
              {refreshing ? "Đang quét..." : "🔄 Quét lại app"}
            </button>
            <button className="browse-btn" onClick={handleBrowseApp} disabled={running}>
              + Chọn file .exe từ máy
            </button>
          </div>
        </div>

        {/* Thanh tìm kiếm và Bộ lọc */}
        <div className="search-and-filter">
          <div className="search-box">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Tìm kiếm ứng dụng (ví dụ: Chrome, Code, Zalo, Excel)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={running}
            />
            {searchQuery && (
              <button className="clear-search" onClick={() => setSearchQuery("")}>✕</button>
            )}
          </div>

          <div className="filter-bar">
            <div className="filter-chips">
              <button className={`chip ${categoryFilter === "all" ? "active" : ""}`} onClick={() => setCategoryFilter("all")}>Tất cả ({apps.length})</button>
              <button className={`chip ${categoryFilter === "available" ? "active" : ""}`} onClick={() => setCategoryFilter("available")}>Có sẵn ({availableCount})</button>
              <button className={`chip ${categoryFilter === "browser" ? "active" : ""}`} onClick={() => setCategoryFilter("browser")}>Trình duyệt</button>
              <button className={`chip ${categoryFilter === "system" ? "active" : ""}`} onClick={() => setCategoryFilter("system")}>Phần mềm máy</button>
              <button className={`chip ${categoryFilter === "custom" ? "active" : ""}`} onClick={() => setCategoryFilter("custom")}>Tự thêm</button>
            </div>

            {workflow === "multi" && (
              <div className="selection-quick">
                <button type="button" onClick={handleSelectAll} disabled={running}>Chọn tất cả</button>
                <span>•</span>
                <button type="button" onClick={handleDeselectAll} disabled={running}>Bỏ chọn</button>
                <span>•</span>
                <button type="button" onClick={handleInvertSelection} disabled={running} title="Đảo ngược lựa chọn">🔄 Đảo chọn</button>
                <span>•</span>
                <button type="button" onClick={handleSelectOnlyBrowsers} disabled={running} title="Chỉ chọn các trình duyệt có sẵn">🌐 Chỉ trình duyệt</button>
              </div>
            )}
          </div>
        </div>

        {/* Lưới danh sách ứng dụng */}
        <div className="apps-grid">
          {filteredApps.length === 0 ? (
            <div className="empty-apps">
              <p>Không tìm thấy ứng dụng nào khớp với "{searchQuery}".</p>
              <button className="browse-btn" onClick={handleBrowseApp}>Chọn file .exe từ máy tính</button>
            </div>
          ) : (
            filteredApps.map((appItem) => {
              const isSelected = workflow === "multi" ? selectedAppIds.has(appItem.id) : targetAppId === appItem.id;
              return (
                <AppCard
                  key={appItem.id}
                  appItem={appItem}
                  isSelected={isSelected}
                  workflow={workflow}
                  running={running}
                  onSelect={handleCardSelect}
                  onDeleteCustom={handleDeleteCustomApp}
                />
              );
            })
          )}
        </div>
      </section>

      {/* Bước 3: Cấu hình chi tiết */}
      <section className="panel">
        <div className="section-heading">
          <div>
            <span className="step">03</span>
            <h2>Cấu hình & Tùy chọn màn hình</h2>
          </div>
          <span className="muted">Điều chỉnh cách hiển thị và phiên làm việc</span>
        </div>

        <div className="fields">
          {workflow === "single" && (
            <label className="field">
              <span>Số lượng bản mở</span>
              <div className="number-control">
                <button aria-label="Giảm" onClick={() => setCount((v) => Math.max(1, v - 1))} disabled={running || count <= 1}>−</button>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={count}
                  disabled={running}
                  onChange={(e) => setCount(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
                />
                <button aria-label="Tăng" onClick={() => setCount((v) => Math.min(20, v + 1))} disabled={running || count >= 20}>+</button>
              </div>
            </label>
          )}

          <label className="field">
            <span>Độ trễ giữa mỗi lần mở</span>
            <select value={delayMs} disabled={running} onChange={(e) => setDelayMs(Number(e.target.value))}>
              <option value={0}>Ngay lập tức (0s)</option>
              <option value={500}>0,5 giây</option>
              <option value={1000}>1 giây (khuyên dùng)</option>
              <option value={2000}>2 giây</option>
              <option value={3000}>3 giây</option>
            </select>
          </label>

          {/* Chế độ cửa sổ / Tab */}
          <label className="field">
            <span>Chế độ cửa sổ (đối với Trình duyệt)</span>
            <select value={mode} disabled={running} onChange={(e) => setMode(e.target.value)}>
              <option value="windows">Nhiều Cửa sổ riêng biệt (Tự chia màn hình)</option>
              <option value="tabs">Nhiều Tab (Chung 1 cửa sổ)</option>
            </select>
          </label>

          {/* Tách biệt Profile độc lập */}
          <label className="field">
            <span>Chế độ Profile / Cookie (Trình duyệt)</span>
            <select value={profileMode} disabled={running} onChange={(e) => setProfileMode(e.target.value)}>
              <option value="normal">Mặc định (Dùng chung Profile chính)</option>
              <option value="isolated">⭐ Tách biệt Profile riêng (Mỗi cửa sổ 1 tài khoản/cookie riêng)</option>
              <option value="incognito">Ẩn danh / Riêng tư (Incognito / InPrivate)</option>
            </select>
          </label>
        </div>

        {/* Nhập URL hoặc Tham số */}
        <label className="field url-field">
          <span>
            Danh sách URL / Tham số mở{" "}
            <small>(Mỗi dòng một URL; các trình duyệt sẽ nhận URL tương ứng)</small>
          </span>
          <textarea
            value={urls}
            onChange={(e) => setUrls(e.target.value)}
            disabled={running}
            rows="3"
            placeholder={"https://www.google.com\nhttps://www.youtube.com\nhttps://github.com"}
          />
        </label>

        {mode === "windows" && (
          <label className="check-row">
            <input type="checkbox" checked={grid} disabled={running} onChange={(e) => setGrid(e.target.checked)} />
            <span>
              <strong>Tự động sắp xếp vừa khít toàn bộ màn hình (Auto Fit Grid)</strong>
              <small>
                Hệ thống tự tính toán kích thước và chia đều diện tích màn hình để tất cả cửa sổ khớp hoàn toàn với màn hình máy tính (không đè lên nhau, không để lại khoảng trống thừa).
              </small>
            </span>
          </label>
        )}

        {/* Thanh công cụ bố cục màn hình */}
        <div className="layout-toolbar">
          <span className="layout-toolbar-title">📐 Bố cục màn hình nhanh:</span>
          <div className="layout-btn-group">
            <button type="button" className="layout-btn" onClick={() => handleArrangeWithLayout("auto")} title="Tự động chia đều diện tích màn hình theo tỷ lệ tối ưu">
              🔲 Tự động
            </button>
            <button type="button" className="layout-btn" onClick={() => handleArrangeWithLayout("split-2")} title="Chia đôi màn hình thành 2 cột (50% - 50%)">
              ◫ 2 Cột (50/50)
            </button>
            <button type="button" className="layout-btn" onClick={() => handleArrangeWithLayout("split-3")} title="Chia màn hình thành 3 cột đều nhau">
              ▥ 3 Cột
            </button>
            <button type="button" className="layout-btn" onClick={() => handleArrangeWithLayout("grid-2x2")} title="Chia thành lưới 4 góc (2 hàng, 2 cột)">
              ⊞ 4 Ô (2x2)
            </button>
            <button type="button" className="layout-btn" onClick={() => handleArrangeWithLayout("grid-3x2")} title="Chia thành lưới 6 ô (2 hàng, 3 cột)">
              ▦ 6 Ô (3x2)
            </button>
            <button type="button" className="layout-btn" onClick={() => handleArrangeWithLayout("minimize")} title="Thu nhỏ tất cả cửa sổ mục tiêu">
              🗕 Thu nhỏ
            </button>
            <button type="button" className="layout-btn" onClick={() => handleArrangeWithLayout("restore")} title="Khôi phục và hiển thị lại toàn bộ các cửa sổ">
              🗖 Khôi phục
            </button>
          </div>
        </div>
      </section>

      {/* Bước 4: Đồng bộ thao tác chuột (Mouse Synchronizer) */}
      <section className={`panel sync-panel ${syncActive ? "sync-panel-active" : ""}`}>
        <div className="section-heading">
          <div>
            <span className="step">04</span>
            <h2>Đồng bộ thao tác chuột đa tab (Mouse Synchronizer)</h2>
          </div>
          <span className={`pill ${syncActive ? "pill-active" : ""}`}>
            {syncActive ? `● ĐANG ĐỒNG BỘ (${syncCount || "đa"} cửa sổ)` : "○ Đang tắt (Dùng từng tab độc lập)"}
          </span>
        </div>

        <div className="sync-box">
          <div className="sync-info">
            <strong>
              {syncActive
                ? `🟢 Tính năng đồng bộ chuột đang BẬT: Đang điều khiển đồng loạt ${syncCount > 0 ? syncCount : "các"} cửa sổ!`
                : "🔘 Bấm để bật đồng bộ chuột giữa các cửa sổ đã mở"}
            </strong>
            <small>
              {syncActive
                ? "Bất kỳ thao tác click chuột trái, phải, chuột giữa hoặc cuộn trang trên một cửa sổ bất kỳ sẽ ngay lập tức được nhân bản sang toàn bộ các cửa sổ còn lại. Nhấn F8 trên bàn phím bất cứ lúc nào để Bật/Tắt tức thì mà không cần chuyển về cửa sổ này."
                : "Khi bật, bạn chỉ cần điều khiển chuột trên 1 cửa sổ, các cửa sổ khác sẽ tự động click và cuộn theo y hệt. Phím tắt F8 toàn cục cho phép bật/tắt mọi lúc."}
            </small>
          </div>

          <button
            type="button"
            className={`sync-toggle-btn ${syncActive ? "active" : ""}`}
            onClick={handleToggleSync}
          >
            <span className="sync-pulse-dot"></span>
            {syncActive ? "TẮT ĐỒNG BỘ (Phím F8)" : "BẬT ĐỒNG BỘ CHUỘT (Phím F8)"}
          </button>
        </div>
      </section>

      {/* Bước 5: Trạng thái & Nút hành động */}
      <section className="panel status-panel">
        <div className="section-heading">
          <div>
            <span className="step">05</span>
            <h2>Khởi chạy & Điều khiển</h2>
          </div>
          <strong className="counter">
            {progress.opened}
            <span> / {progress.total}</span>
          </strong>
        </div>

        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${percent}%` }} />
        </div>

        <p className="status-text">{status}</p>

        {error && <div className="error-box">{error}</div>}

        <div className="actions">
          <button
            className="primary"
            onClick={() => handleStart()}
            disabled={running || (workflow === "multi" ? selectedCount === 0 : !currentTargetApp?.available)}
          >
            ▶ &nbsp; {workflow === "multi" ? `Khởi chạy ${selectedCount} app` : `Khởi chạy ${currentTargetApp ? currentTargetApp.name : "app"}`}
          </button>

          <button
            type="button"
            className="secondary run-grid-btn"
            onClick={handleComboLaunchAndGrid}
            disabled={running || (workflow === "multi" ? selectedCount === 0 : !currentTargetApp?.available)}
            title="Mở ứng dụng và tự động chia lưới vừa khít màn hình khi mở xong"
          >
            🚀 Chạy & Chia lưới
          </button>

          <button
            type="button"
            className="secondary run-sync-btn"
            onClick={handleComboLaunchAndSync}
            disabled={running || (workflow === "multi" ? selectedCount === 0 : !currentTargetApp?.available)}
            title="Mở ứng dụng, tự động chia lưới và BẬT ngay tính năng đồng bộ chuột F8"
          >
            🎯 Chạy & Sync F8
          </button>
          
          <button
            type="button"
            className="secondary arrange-btn"
            onClick={() => handleArrangeWithLayout("auto")}
            title="Căn chỉnh lại toàn bộ cửa sổ đang hiển thị vừa khít với màn hình máy tính"
          >
            📐 Chia lưới
          </button>

          <button className="secondary stop-btn" onClick={handleStop} disabled={!running}>
            ■ &nbsp; Dừng (Esc)
          </button>
        </div>

        <p className="notice">
          Mẹo: Sau khi mở nhiều cửa sổ và căn chỉnh vừa màn hình, bạn có thể bấm <strong>"BẬT ĐỒNG BỘ CHUỘT"</strong> (hoặc nhấn phím <strong>F8</strong> trên bàn phím) để bắt đầu điều khiển chuột chung cho tất cả các tab!
        </p>
      </section>

      {/* Modal Popup Lưu Kịch Bản */}
      {showSavePresetModal && (
        <div className="modal-overlay" onClick={() => setShowSavePresetModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>💾 Lưu cấu hình hiện tại thành Kịch bản</h3>
            <p>Kịch bản sẽ ghi nhớ chế độ mở, các ứng dụng đã chọn, số lượng, bố cục và danh sách URL để bạn mở lại nhanh bất cứ lúc nào.</p>

            <div className="modal-field">
              <label>Biểu tượng:</label>
              <div className="icon-selector">
                {["⚡", "💼", "🌐", "🎮", "💻", "🔥", "🚀", "📊", "🤖", "⭐"].map((ic) => (
                  <button
                    key={ic}
                    type="button"
                    className={`icon-choice ${newPresetIcon === ic ? "selected" : ""}`}
                    onClick={() => setNewPresetIcon(ic)}
                  >
                    {ic}
                  </button>
                ))}
              </div>
            </div>

            <div className="modal-field">
              <label>Tên kịch bản:</label>
              <input
                type="text"
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                placeholder="Ví dụ: Cày 4 acc Facebook, Dự án Web, MMO Chrome..."
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSavePreset();
                  if (e.key === "Escape") setShowSavePresetModal(false);
                }}
              />
            </div>

            <div className="modal-actions">
              <button type="button" className="secondary" onClick={() => setShowSavePresetModal(false)}>
                Hủy bỏ
              </button>
              <button type="button" className="primary" onClick={handleSavePreset}>
                Lưu kịch bản
              </button>
            </div>
          </div>
        </div>
      )}

      <footer>
        Multi Launcher Pro <span>•</span> Electron + React <span>•</span> Quản lý & Khởi chạy đa ứng dụng Windows <span>•</span> Hỗ trợ F8 Mouse Sync & Multi-Profiles
      </footer>
    </main>
  );
}