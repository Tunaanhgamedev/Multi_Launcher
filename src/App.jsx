import { useEffect, useState, useMemo } from "react";

const DEFAULT_URLS = "https://www.google.com";
const STORAGE_KEY_CUSTOM_APPS = "multi_launcher_custom_apps";

export default function App() {
  const [workflow, setWorkflow] = useState("multi"); // "multi": Mở tổ hợp nhiều app, "single": Mở hàng loạt 1 app
  const [apps, setApps] = useState([]);
  const [selectedAppIds, setSelectedAppIds] = useState(new Set());
  const [targetAppId, setTargetAppId] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  
  // Cấu hình mở
  const [mode, setMode] = useState("windows"); // Mặc định mở nhiều Cửa sổ riêng
  const [count, setCount] = useState(5);
  const [delayMs, setDelayMs] = useState(1000);
  const [urls, setUrls] = useState(DEFAULT_URLS);
  const [grid, setGrid] = useState(true); // Mặc định tự động dàn cửa sổ vừa khít màn hình

  // Tiến trình & Trạng thái
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("Sẵn sàng. Hãy chọn ứng dụng và nhấn bắt đầu.");
  const [progress, setProgress] = useState({ opened: 0, total: 0 });
  const [error, setError] = useState("");

  // Tải danh sách ứng dụng đã cài đặt và ứng dụng tùy chọn
  useEffect(() => {
    async function loadApps() {
      try {
        const detected = await window.launcher.getDetectedApps();
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

        // Mặc định chọn app khả dụng đầu tiên cho chế độ Single
        const firstAvailable = combined.find((a) => a.available);
        if (firstAvailable) {
          setTargetAppId(firstAvailable.id);
        }

        // Mặc định chọn 2-3 app phổ biến có sẵn cho chế độ Multi
        const defaultMulti = combined.filter((a) => a.available && ["chrome", "edge", "coccoc", "vscode", "notepad"].includes(a.id));
        if (defaultMulti.length > 0) {
          setSelectedAppIds(new Set(defaultMulti.map((a) => a.id)));
        } else if (firstAvailable) {
          setSelectedAppIds(new Set([firstAvailable.id]));
        }
      } catch (err) {
        setError("Không thể tải danh sách ứng dụng: " + err.message);
      }
    }

    loadApps();

    const unsubscribe = window.launcher.onProgress((event) => {
      if (event.type === "progress") {
        setProgress({ opened: event.opened, total: event.total });
        setStatus(event.message);
      } else if (event.type === "done") {
        setRunning(false);
        setProgress({ opened: event.opened, total: event.total });
        setStatus(event.message);
      } else if (event.type === "warning") {
        setStatus(event.message);
      }
    });

    return unsubscribe;
  }, []);

  // Lọc danh mục ứng dụng
  const filteredApps = useMemo(() => {
    return apps.filter((app) => {
      if (categoryFilter === "available") return app.available;
      if (categoryFilter === "browser") return app.type === "browser";
      if (categoryFilter === "custom") return app.isCustom;
      if (categoryFilter === "system") return !app.isCustom && app.type !== "browser";
      return true;
    });
  }, [apps, categoryFilter]);

  // Thêm ứng dụng tùy chọn từ máy
  async function handleBrowseApp() {
    setError("");
    try {
      const res = await window.launcher.browseApp();
      if (res.canceled || !res.app) return;

      const newApp = res.app;
      const updatedApps = [...apps.filter((a) => a.path !== newApp.path), newApp];
      setApps(updatedApps);

      // Lưu các custom app vào localStorage
      const customOnly = updatedApps.filter((a) => a.isCustom);
      localStorage.setItem(STORAGE_KEY_CUSTOM_APPS, JSON.stringify(customOnly));

      // Tự động chọn app vừa thêm
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
  function handleDeleteCustomApp(e, appId) {
    e.stopPropagation();
    const updated = apps.filter((a) => a.id !== appId);
    setApps(updated);
    const customOnly = updated.filter((a) => a.isCustom);
    localStorage.setItem(STORAGE_KEY_CUSTOM_APPS, JSON.stringify(customOnly));

    setSelectedAppIds((prev) => {
      const next = new Set(prev);
      next.delete(appId);
      return next;
    });

    if (targetAppId === appId) {
      const fallback = updated.find((a) => a.available);
      if (fallback) setTargetAppId(fallback.id);
    }
  }

  // Chuyển đổi chọn app trong chế độ Multi
  function toggleAppSelection(appId) {
    setSelectedAppIds((prev) => {
      const next = new Set(prev);
      if (next.has(appId)) {
        next.delete(appId);
      } else {
        next.add(appId);
      }
      return next;
    });
  }

  function handleSelectAll() {
    const availableIds = filteredApps.filter((a) => a.available).map((a) => a.id);
    setSelectedAppIds(new Set(availableIds));
  }

  function handleDeselectAll() {
    setSelectedAppIds(new Set());
  }

  // Căn chỉnh ngay các cửa sổ trên màn hình
  async function handleArrangeNow() {
    setError("");
    setStatus("Đang căn chỉnh các cửa sổ vừa khít màn hình...");
    try {
      const targetPattern = workflow === "single"
        ? (currentTargetApp?.windowPattern || currentTargetApp?.name || "Chrome")
        : (apps.filter((a) => selectedAppIds.has(a.id)).map((a) => a.windowPattern || a.name).join("|") || ".*");
      const res = await window.launcher.arrangeWindows(targetPattern);
      if (res.arranged) {
        setStatus(res.message || "Đã căn chỉnh các cửa sổ thành công.");
      } else {
        setError(res.message || "Không thể sắp xếp cửa sổ.");
      }
    } catch (e) {
      setError("Lỗi khi căn chỉnh cửa sổ: " + e.message);
    }
  }

  // Bắt đầu khởi chạy
  async function handleStart() {
    setError("");
    setRunning(true);

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
        grid
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
        grid
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
  const currentTargetApp = apps.find((a) => a.id === targetAppId);
  const percent = progress.total ? Math.min(100, Math.round((progress.opened / progress.total) * 100)) : 0;
  const availableCount = apps.filter((a) => a.available).length;

  return (
    <main className="shell">
      {/* Top Header */}
      <header className="topbar">
        <div className="brand-icon">ML</div>
        <div>
          <p className="eyebrow">WINDOWS MULTI-APP LAUNCHER</p>
          <h1>Multi Launcher</h1>
          <p className="subtitle">Khởi chạy nhiều ứng dụng & tự sắp xếp vừa khít màn hình máy tính</p>
        </div>
        <span className="pill ok">
          Đã nhận diện: {availableCount} ứng dụng
        </span>
      </header>

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
              <small>Tích chọn nhiều phần mềm khác nhau (Chrome, Edge, VS Code, Notepad...) và mở cùng lúc chỉ với 1 click.</small>
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
              <small>Mở nhiều cửa sổ hoặc tab của một ứng dụng duy nhất kèm danh sách URL hoặc tham số.</small>
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
            <button className="browse-btn" onClick={handleBrowseApp} disabled={running}>
              + Chọn file .exe từ máy
            </button>
          </div>
        </div>

        {/* Bộ lọc danh mục */}
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
              <button onClick={handleSelectAll} disabled={running}>Chọn tất cả</button>
              <span>•</span>
              <button onClick={handleDeselectAll} disabled={running}>Bỏ chọn</button>
            </div>
          )}
        </div>

        {/* Lưới danh sách ứng dụng */}
        <div className="apps-grid">
          {filteredApps.map((appItem) => {
            const isSelected = workflow === "multi" ? selectedAppIds.has(appItem.id) : targetAppId === appItem.id;
            return (
              <div
                key={appItem.id}
                className={`app-card ${isSelected ? "selected" : ""} ${!appItem.available ? "unavailable" : ""}`}
                onClick={() => {
                  if (!appItem.available || running) return;
                  if (workflow === "multi") {
                    toggleAppSelection(appItem.id);
                  } else {
                    setTargetAppId(appItem.id);
                  }
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
                      onClick={(e) => handleDeleteCustomApp(e, appItem.id)}
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
          })}
        </div>
      </section>

      {/* Bước 3: Cấu hình chi tiết */}
      <section className="panel">
        <div className="section-heading">
          <div>
            <span className="step">03</span>
            <h2>Cấu hình & Tùy chọn màn hình</h2>
          </div>
          <span className="muted">Điều chỉnh cách hiển thị trên màn hình</span>
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
                Thay vì mỗi cửa sổ mở ra đều full màn đè lên nhau, hệ thống sẽ tự tính toán kích thước và chia đều diện tích màn hình để tất cả cửa sổ khớp hoàn toàn với màn hình máy tính (không để lại khoảng trống thừa).
              </small>
            </span>
          </label>
        )}
      </section>

      {/* Bước 4: Trạng thái & Nút hành động */}
      <section className="panel status-panel">
        <div className="section-heading">
          <div>
            <span className="step">04</span>
            <h2>Trạng thái & Điều khiển</h2>
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
            onClick={handleStart}
            disabled={running || (workflow === "multi" ? selectedCount === 0 : !currentTargetApp?.available)}
          >
            ▶ &nbsp; {workflow === "multi" ? `Bắt đầu mở ${selectedCount} ứng dụng` : `Bắt đầu mở ${currentTargetApp ? currentTargetApp.name : "ứng dụng"}`}
          </button>
          
          <button
            type="button"
            className="secondary arrange-btn"
            onClick={handleArrangeNow}
            title="Căn chỉnh lại toàn bộ cửa sổ đang hiển thị vừa khít với màn hình máy tính"
          >
            📐 Căn chỉnh cửa sổ ngay
          </button>

          <button className="secondary stop-btn" onClick={handleStop} disabled={!running}>
            ■ &nbsp; Dừng lại
          </button>
        </div>

        <p className="notice">
          Mẹo: Nếu bạn đã có sẵn các cửa sổ đang mở hoặc bị lệch kích thước, bạn có thể nhấn <strong>"📐 Căn chỉnh cửa sổ ngay"</strong> bất kỳ lúc nào để tự động dàn đều chúng khít với màn hình.
        </p>
      </section>

      <footer>
        Multi Launcher <span>•</span> Electron + React <span>•</span> Quản lý & Khởi chạy đa ứng dụng Windows
      </footer>
    </main>
  );
}