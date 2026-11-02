const fs = require("node:fs");
const path = require("node:path");

// Danh sách User-Agent máy tính thực tế, hiện đại (Windows 10/11)
const REALISTIC_USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Brave/131.0.0.0"
];

// Danh sách cấu hình GPU WebGL chân thực để đánh lừa thuật toán quét phần cứng
const GPU_CONFIGS = [
  { vendor: "Google Inc. (NVIDIA)", renderer: "ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0, D3D11)" },
  { vendor: "Google Inc. (NVIDIA)", renderer: "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)" },
  { vendor: "Google Inc. (NVIDIA)", renderer: "ANGLE (NVIDIA, NVIDIA GeForce RTX 3050 Direct3D11 vs_5_0 ps_5_0, D3D11)" },
  { vendor: "Google Inc. (NVIDIA)", renderer: "ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 SUPER Direct3D11 vs_5_0 ps_5_0, D3D11)" },
  { vendor: "Google Inc. (AMD)", renderer: "ANGLE (AMD, AMD Radeon RX 6700 XT Direct3D11 vs_5_0 ps_5_0, D3D11)" },
  { vendor: "Google Inc. (AMD)", renderer: "ANGLE (AMD, AMD Radeon RX 6600 Direct3D11 vs_5_0 ps_5_0, D3D11)" },
  { vendor: "Google Inc. (Intel)", renderer: "ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)" },
  { vendor: "Google Inc. (Intel)", renderer: "ANGLE (Intel, Intel(R) UHD Graphics 770 Direct3D11 vs_5_0 ps_5_0, D3D11)" }
];

// Danh sách độ phân giải màn hình phổ biến chuẩn desktop
const SCREEN_RESOLUTIONS = [
  { width: 1920, height: 1080, availWidth: 1920, availHeight: 1040 },
  { width: 2560, height: 1440, availWidth: 2560, availHeight: 1400 },
  { width: 1680, height: 1050, availWidth: 1680, availHeight: 1010 },
  { width: 1600, height: 900,  availWidth: 1600, availHeight: 860 },
  { width: 1536, height: 864,  availWidth: 1536, availHeight: 824 },
  { width: 1440, height: 900,  availWidth: 1440, availHeight: 860 },
  { width: 1366, height: 768,  availWidth: 1366, availHeight: 728 }
];

const CPU_CORES_POOL = [4, 6, 8, 12, 16];
const MEMORY_POOL = [8, 16, 32];

/**
 * Phân tích danh sách Proxy từ văn bản đa dòng do người dùng nhập vào
 * Định dạng hỗ trợ:
 * - 1.2.3.4:8080
 * - http://1.2.3.4:8080
 * - socks5://1.2.3.4:1080
 * - 1.2.3.4:8080:user:pass
 * - user:pass@1.2.3.4:8080
 */
function parseProxyList(rawText) {
  if (!rawText || typeof rawText !== "string") return [];
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const result = [];

  for (const line of lines) {
    let clean = line;
    let scheme = "http";
    if (clean.startsWith("socks5://")) {
      scheme = "socks5";
      clean = clean.replace("socks5://", "");
    } else if (clean.startsWith("socks4://")) {
      scheme = "socks4";
      clean = clean.replace("socks4://", "");
    } else if (clean.startsWith("http://")) {
      scheme = "http";
      clean = clean.replace("http://", "");
    } else if (clean.startsWith("https://")) {
      scheme = "https";
      clean = clean.replace("https://", "");
    }

    let host = "";
    let port = "";
    let user = "";
    let pass = "";

    if (clean.includes("@")) {
      const [authPart, hostPart] = clean.split("@");
      const [u, p] = authPart.split(":");
      user = u || "";
      pass = p || "";
      const [h, pt] = (hostPart || "").split(":");
      host = h || "";
      port = pt || "8080";
    } else {
      const parts = clean.split(":");
      if (parts.length >= 4) {
        host = parts[0];
        port = parts[1];
        user = parts[2];
        pass = parts[3];
      } else if (parts.length === 2) {
        host = parts[0];
        port = parts[1];
      } else {
        host = parts[0];
        port = "8080";
      }
    }

    if (host) {
      result.push({
        raw: line,
        scheme,
        host,
        port,
        user,
        pass,
        serverUrl: `${scheme}://${host}:${port}`
      });
    }
  }

  return result;
}

/**
 * Tạo tiện ích mở rộng (Unpacked Chrome Extension) "Màn Chắn Chống Quét" chuyên dụng cho từng Profile.
 * Tiện ích này sẽ tự động chạy trước mọi kịch bản của website (document_start), giả lập thông số
 * thiết bị mới lạ (Hardware, WebGL, Canvas, Audio, WebRTC, navigator.webdriver) riêng biệt.
 */
function createShieldExtension(extensionDir, profileIndex, profileConfig = {}) {
  if (!fs.existsSync(extensionDir)) {
    fs.mkdirSync(extensionDir, { recursive: true });
  }

  const {
    userAgent = REALISTIC_USER_AGENTS[profileIndex % REALISTIC_USER_AGENTS.length],
    gpu = GPU_CONFIGS[profileIndex % GPU_CONFIGS.length],
    cores = CPU_CORES_POOL[profileIndex % CPU_CORES_POOL.length],
    memory = MEMORY_POOL[profileIndex % MEMORY_POOL.length],
    screen = SCREEN_RESOLUTIONS[profileIndex % SCREEN_RESOLUTIONS.length],
    canvasSeed = (profileIndex + 1) * 7 + 3,
    audioNoise = ((profileIndex + 1) * 0.0000031).toFixed(7),
    timezone = "",
    proxy = null
  } = profileConfig;

  // 1. Tạo file manifest.json cho Extension
  const hasProxyAuth = Boolean(proxy && proxy.user && proxy.pass);
  const manifest = {
    manifest_version: 3,
    name: `Multi Launcher Shield Profile ${profileIndex + 1}`,
    version: "1.2",
    description: "Màn chắn bảo vệ danh tính thiết bị và chống quét đa tài khoản",
    content_scripts: [
      {
        matches: ["<all_urls>"],
        js: ["shield.js"],
        run_at: "document_start",
        world: "MAIN"
      }
    ]
  };

  if (hasProxyAuth) {
    manifest.permissions = ["webRequest", "webRequestAuthProvider"];
    manifest.host_permissions = ["<all_urls>"];
    manifest.background = {
      service_worker: "background.js"
    };

    const bgJs = `
// Tự động xác thực tài khoản Proxy ngầm mà không làm hiện bảng hỏi mật khẩu
chrome.webRequest.onAuthRequired.addListener(
  function(details) {
    return {
      authCredentials: {
        username: "${proxy.user.replace(/"/g, '\\"')}",
        password: "${proxy.pass.replace(/"/g, '\\"')}"
      }
    };
  },
  { urls: ["<all_urls>"] },
  ["blocking"]
);
`;
    fs.writeFileSync(path.join(extensionDir, "background.js"), bgJs, "utf8");
  }

  fs.writeFileSync(path.join(extensionDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");

  // 2. Tạo file shield.js (Kịch bản lõi của Màn Chắn với ngụy trang nâng cao)
  const timezoneCode = timezone && timezone !== "auto" ? `
  // Giả lập Múi giờ địa phương (Timezone)
  try {
    const TARGET_TZ = "${timezone.replace(/"/g, '\\"')}";
    const origResolved = Intl.DateTimeFormat.prototype.resolvedOptions;
    Intl.DateTimeFormat.prototype.resolvedOptions = function() {
      const res = origResolved.apply(this, arguments);
      return Object.assign({}, res, { timeZone: TARGET_TZ });
    };
  } catch (e) {}
` : "";

  const shieldJs = `
// ========================================================
// Multi Launcher Pro - Màn Chắn Chống Quét & Vân Tay Thiết Bị
// Profile ID: ${profileIndex + 1}
// ========================================================
(function() {
  'use strict';

  // 1. XÓA DẤU VẾT AUTOMATION (navigator.webdriver)
  try {
    Object.defineProperty(Navigator.prototype, 'webdriver', {
      get: () => undefined,
      enumerable: true,
      configurable: true
    });
    delete Object.getPrototypeOf(navigator).webdriver;
  } catch (e) {}

  if (!window.chrome) {
    window.chrome = {
      runtime: {},
      loadTimes: function() {},
      csi: function() {},
      app: {}
    };
  }

  // 2. GIẢ LẬP PHẦN CỨNG RIÊNG BIỆT (CPU Cores & RAM)
  try {
    Object.defineProperty(Navigator.prototype, 'hardwareConcurrency', {
      get: () => ${cores},
      enumerable: true,
      configurable: true
    });
    Object.defineProperty(Navigator.prototype, 'deviceMemory', {
      get: () => ${memory},
      enumerable: true,
      configurable: true
    });
    Object.defineProperty(Navigator.prototype, 'maxTouchPoints', {
      get: () => 0,
      enumerable: true,
      configurable: true
    });
  } catch (e) {}

  // 3. ĐỒNG BỘ NGÔN NGỮ & ĐỊA PHƯƠNG
  try {
    Object.defineProperty(Navigator.prototype, 'languages', {
      get: () => ['vi-VN', 'vi', 'en-US', 'en'],
      enumerable: true,
      configurable: true
    });
    Object.defineProperty(Navigator.prototype, 'language', {
      get: () => 'vi-VN',
      enumerable: true,
      configurable: true
    });
  } catch (e) {}

  // 4. GIẢ LẬP ĐỘ PHÂN GIẢI MÀN HÌNH ĐỘC LẬP
  try {
    const sW = ${screen.width};
    const sH = ${screen.height};
    const avW = ${screen.availWidth};
    const avH = ${screen.availHeight};
    Object.defineProperty(window.screen, 'width', { get: () => sW, configurable: true });
    Object.defineProperty(window.screen, 'height', { get: () => sH, configurable: true });
    Object.defineProperty(window.screen, 'availWidth', { get: () => avW, configurable: true });
    Object.defineProperty(window.screen, 'availHeight', { get: () => avH, configurable: true });
    Object.defineProperty(window.screen, 'colorDepth', { get: () => 24, configurable: true });
    Object.defineProperty(window.screen, 'pixelDepth', { get: () => 24, configurable: true });
  } catch (e) {}
${timezoneCode}

  // 5. MÀN CHẮN WEBGL (GIẢ LẬP GPU ĐỘC LẬP CHO TỪNG CỬA SỔ)
  try {
    const SPOOF_VENDOR = "${gpu.vendor.replace(/"/g, '\\"')}";
    const SPOOF_RENDERER = "${gpu.renderer.replace(/"/g, '\\"')}";

    const hookGl = function(targetProto) {
      if (!targetProto || !targetProto.getParameter) return;
      const origGetParam = targetProto.getParameter;
      targetProto.getParameter = function(param) {
        if (param === 37445) return SPOOF_VENDOR;   // UNMASKED_VENDOR_WEBGL
        if (param === 37446) return SPOOF_RENDERER; // UNMASKED_RENDERER_WEBGL
        return origGetParam.apply(this, [param]);
      };
    };

    if (window.WebGLRenderingContext) hookGl(WebGLRenderingContext.prototype);
    if (window.WebGL2RenderingContext) hookGl(WebGL2RenderingContext.prototype);
  } catch (e) {}

  // 6. MÀN CHẮN CANVAS (DETERMINISTIC PER-PROFILE MICRO NOISE)
  try {
    const SEED = ${canvasSeed};
    const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function(...args) {
      try {
        if (this.width > 0 && this.height > 0) {
          const ctx = this.getContext('2d');
          if (ctx) {
            const checkW = Math.min(this.width, 16);
            const checkH = Math.min(this.height, 16);
            const img = ctx.getImageData(0, 0, checkW, checkH);
            if (img && img.data && img.data.length >= 4) {
              for (let i = 0; i < img.data.length; i += 4) {
                if (img.data[i + 3] > 0) {
                  img.data[i] = (img.data[i] + (SEED % 3)) % 256;
                  break;
                }
              }
              ctx.putImageData(img, 0, 0);
            }
          }
        }
      } catch (err) {}
      return origToDataURL.apply(this, args);
    };

    const origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
    CanvasRenderingContext2D.prototype.getImageData = function(...args) {
      const res = origGetImageData.apply(this, args);
      if (res && res.data && res.data.length >= 4) {
        for (let i = 0; i < Math.min(res.data.length, 32); i += 4) {
          if (res.data[i + 3] > 0) {
            res.data[i] = (res.data[i] + (SEED % 3)) % 256;
            break;
          }
        }
      }
      return res;
    };
  } catch (e) {}

  // 7. MÀN CHẮN AUDIO CONTEXT NÂNG CAO (LÀM LỆCH HASH ÂM THANH MÀ KHÔNG GÂY RÈ)
  try {
    const AUDIO_OFFSET = ${audioNoise};
    if (window.AudioBuffer) {
      const origGetChannelData = AudioBuffer.prototype.getChannelData;
      AudioBuffer.prototype.getChannelData = function(ch) {
        const buf = origGetChannelData.apply(this, [ch]);
        if (buf && buf.length > 0) {
          buf[0] = buf[0] + AUDIO_OFFSET;
          if (buf.length > 10) buf[10] = buf[10] - (AUDIO_OFFSET * 0.5);
        }
        return buf;
      };

      if (AudioBuffer.prototype.copyFromChannel) {
        const origCopy = AudioBuffer.prototype.copyFromChannel;
        AudioBuffer.prototype.copyFromChannel = function(dest, ch, start) {
          origCopy.apply(this, [dest, ch, start]);
          if (dest && dest.length > 0) dest[0] = dest[0] + AUDIO_OFFSET;
        };
      }
    }

    if (window.AnalyserNode) {
      const origGetFloatFreq = AnalyserNode.prototype.getFloatFrequencyData;
      AnalyserNode.prototype.getFloatFrequencyData = function(arr) {
        origGetFloatFreq.apply(this, [arr]);
        if (arr && arr.length > 0) arr[0] += AUDIO_OFFSET;
      };
    }
  } catch (e) {}

  // 8. CHỐNG RÒ RỈ ĐỊA CHỈ IP NỘI BỘ QUA WEBRTC
  try {
    if (window.RTCPeerConnection) {
      const origCreateOffer = RTCPeerConnection.prototype.createOffer;
      RTCPeerConnection.prototype.createOffer = function(options) {
        return origCreateOffer.apply(this, [options]);
      };
    }
  } catch (e) {}

  // 9. GIẢ LẬP NETWORK INFORMATION API
  try {
    if (!navigator.connection) {
      Object.defineProperty(Navigator.prototype, 'connection', {
        get: () => ({
          effectiveType: '4g',
          rtt: 50,
          downlink: 10,
          saveData: false
        }),
        configurable: true
      });
    }
  } catch (e) {}
})();
`;
  fs.writeFileSync(path.join(extensionDir, "shield.js"), shieldJs, "utf8");

  return {
    extensionDir,
    userAgent,
    gpu,
    cores,
    memory,
    screen,
    timezone
  };
}

/**
 * Chuẩn bị môi trường Màn Chắn Chống Quét cho Profile thứ i
 * Trả về danh sách cờ dòng lệnh (flags) truyền cho trình duyệt
 */
function prepareShieldFlags(profileDir, profileIndex, shieldOptions = {}) {
  const proxyList = parseProxyList(shieldOptions.proxies || "");
  const assignedProxy = proxyList.length > 0 ? proxyList[profileIndex % proxyList.length] : null;

  const extensionDir = path.join(profileDir, "anti_detect_shield");
  const extInfo = createShieldExtension(extensionDir, profileIndex, {
    proxy: assignedProxy,
    timezone: shieldOptions.timezone || ""
  });

  const flags = [
    // Xóa dấu vết Chrome Automation
    "--disable-blink-features=AutomationControlled",

    // Khóa rò rỉ IP nội bộ qua WebRTC
    "--force-webrtc-ip-handling-policy=default_public_interface_only",
    "--disable-webrtc-multiple-routes",
    "--enforce-webrtc-ip-permission-check",

    // Tắt các tính năng theo dõi client hints của Google
    "--disable-features=UserAgentClientHint,CalculateNativeWinOcclusion",

    // Gán User-Agent độc lập cho cửa sổ này
    `--user-agent=${extInfo.userAgent}`,

    // Gán ngôn ngữ chuẩn
    "--lang=vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",

    // Nạp Màn Chắn Extension vào trình duyệt
    `--load-extension=${extensionDir}`,
    `--disable-extensions-except=${extensionDir}`
  ];

  // Nếu có cấu hình Múi giờ
  if (shieldOptions.timezone && shieldOptions.timezone !== "auto") {
    flags.push(`--timezone=${shieldOptions.timezone}`);
  }

  // Nếu có cấu hình Proxy cho cửa sổ này
  if (assignedProxy) {
    flags.push(`--proxy-server=${assignedProxy.serverUrl}`);
  }

  return {
    flags,
    info: {
      profileIndex,
      userAgent: extInfo.userAgent,
      gpu: extInfo.gpu.renderer,
      cores: extInfo.cores,
      memory: extInfo.memory,
      screen: `${extInfo.screen.width}x${extInfo.screen.height}`,
      timezone: shieldOptions.timezone || "auto",
      proxy: assignedProxy ? assignedProxy.serverUrl : null
    }
  };
}

module.exports = {
  REALISTIC_USER_AGENTS,
  GPU_CONFIGS,
  SCREEN_RESOLUTIONS,
  parseProxyList,
  createShieldExtension,
  prepareShieldFlags
};
