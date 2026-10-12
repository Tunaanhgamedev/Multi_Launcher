param(
  [string]$pattern = 'Chrome|Edge|CocCoc|browser',
  [int]$launcherPid = 0
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Windows.Forms

$code = @"
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Windows.Forms;

public class MouseSyncService {
  public const int WH_MOUSE_LL = 14;
  public const int WM_LBUTTONDOWN = 0x0201;
  public const int WM_LBUTTONUP = 0x0202;
  public const int WM_RBUTTONDOWN = 0x0204;
  public const int WM_RBUTTONUP = 0x0205;
  public const int WM_MOUSEWHEEL = 0x020A;

  public const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
  public const uint MOUSEEVENTF_LEFTUP = 0x0004;
  public const uint MOUSEEVENTF_RIGHTDOWN = 0x0008;
  public const uint MOUSEEVENTF_RIGHTUP = 0x0010;
  public const uint MOUSEEVENTF_WHEEL = 0x0800;

  public const long SYNC_MAGIC = 0x594E43; // 'SYNC'

  public delegate IntPtr LowLevelMouseProc(int nCode, IntPtr wParam, IntPtr lParam);
  public static LowLevelMouseProc _proc = HookCallback;
  public static IntPtr _hookID = IntPtr.Zero;

  [DllImport("user32.dll", SetLastError = true)]
  public static extern IntPtr SetWindowsHookEx(int idHook, LowLevelMouseProc lpfn, IntPtr hMod, uint dwThreadId);

  [DllImport("user32.dll", SetLastError = true)]
  public static extern bool UnhookWindowsHookEx(IntPtr hhk);

  [DllImport("user32.dll")]
  public static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);

  [DllImport("kernel32.dll")]
  public static extern IntPtr GetModuleHandle(string lpModuleName);

  [DllImport("user32.dll")]
  public static extern bool SetCursorPos(int X, int Y);

  [DllImport("user32.dll")]
  public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, UIntPtr dwExtraInfo);

  [DllImport("user32.dll")]
  public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

  [DllImport("user32.dll")]
  public static extern bool IsWindowVisible(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern bool IsIconic(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern bool IsWindow(IntPtr hWnd);

  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

  [DllImport("user32.dll")]
  public static extern IntPtr WindowFromPoint(POINT Point);

  [DllImport("user32.dll")]
  public static extern IntPtr GetAncestor(IntPtr hwnd, uint gaFlags);
  public const uint GA_ROOT = 2;

  [DllImport("user32.dll")]
  public static extern IntPtr GetForegroundWindow();

  [DllImport("user32.dll")]
  public static extern bool SetForegroundWindow(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")]
  public static extern bool EnumWindows(EnumWindowsProc cb, IntPtr extra);

  [StructLayout(LayoutKind.Sequential)]
  public struct RECT {
    public int Left;
    public int Top;
    public int Right;
    public int Bottom;
    public int Width { get { return Right - Left; } }
    public int Height { get { return Bottom - Top; } }
    public bool Contains(int x, int y) {
      return x >= Left && x <= Right && y >= Top && y <= Bottom;
    }
  }

  [StructLayout(LayoutKind.Sequential)]
  public struct POINT { public int x; public int y; }

  [StructLayout(LayoutKind.Sequential)]
  public struct MSLLHOOKSTRUCT {
    public POINT pt;
    public uint mouseData;
    public uint flags;
    public uint time;
    public IntPtr dwExtraInfo;
  }

  public static List<IntPtr> TrackedHwnds = new List<IntPtr>();
  public static string TargetPattern = "";
  public static uint LauncherPid = 0;
  private static bool _isSyncing = false;

  public static bool IsMultiLauncher(IntPtr hWnd) {
    if (hWnd == IntPtr.Zero) return false;
    try {
      uint pid = 0;
      GetWindowThreadProcessId(hWnd, out pid);
      if (LauncherPid != 0 && pid == LauncherPid) return true;

      if (pid != 0) {
        Process p = Process.GetProcessById((int)pid);
        string name = p.ProcessName.ToLowerInvariant();
        if (name.Contains("multi launcher") || name.Contains("electron")) return true;
      }
    } catch {}

    StringBuilder sb = new StringBuilder(512);
    GetWindowText(hWnd, sb, sb.Capacity);
    string title = sb.ToString();
    if (!string.IsNullOrEmpty(title) && title.IndexOf("Multi Launcher", StringComparison.OrdinalIgnoreCase) >= 0) {
      return true;
    }
    return false;
  }

  public static void RefreshWindows() {
    List<IntPtr> list = new List<IntPtr>();
    EnumWindows((hWnd, lParam) => {
      if (!IsWindow(hWnd) || !IsWindowVisible(hWnd) || IsIconic(hWnd)) return true;
      if (IsMultiLauncher(hWnd)) return true;

      StringBuilder sb = new StringBuilder(512);
      GetWindowText(hWnd, sb, sb.Capacity);
      string title = sb.ToString();
      if (!string.IsNullOrEmpty(title) && title != "Program Manager") {
        bool isMatch = false;
        try {
          isMatch = string.IsNullOrEmpty(TargetPattern) || TargetPattern == ".*" ||
                    Regex.IsMatch(title, TargetPattern, RegexOptions.IgnoreCase);
        } catch {
          isMatch = false;
        }
        if (isMatch) {
          RECT r;
          if (GetWindowRect(hWnd, out r) && r.Width > 120 && r.Height > 100) {
            list.Add(hWnd);
          }
        }
      }
      return true;
    }, IntPtr.Zero);
    TrackedHwnds = list;
  }

  public static int StartHook(string pattern, uint lPid) {
    TargetPattern = pattern;
    LauncherPid = lPid;
    RefreshWindows();
    using (Process curProcess = Process.GetCurrentProcess())
    using (ProcessModule curModule = curProcess.MainModule) {
      _hookID = SetWindowsHookEx(WH_MOUSE_LL, _proc, GetModuleHandle(curModule.ModuleName), 0);
    }
    return TrackedHwnds.Count;
  }

  public static void StopHook() {
    if (_hookID != IntPtr.Zero) {
      UnhookWindowsHookEx(_hookID);
      _hookID = IntPtr.Zero;
    }
  }

  private static IntPtr HookCallback(int nCode, IntPtr wParam, IntPtr lParam) {
    if (nCode >= 0 && !_isSyncing) {
      MSLLHOOKSTRUCT hookStruct = (MSLLHOOKSTRUCT)Marshal.PtrToStructure(lParam, typeof(MSLLHOOKSTRUCT));

      // Không lặp lại các sự kiện do chính tiến trình đồng bộ phát sinh
      if (hookStruct.dwExtraInfo.ToInt64() == SYNC_MAGIC) {
        return CallNextHookEx(_hookID, nCode, wParam, lParam);
      }

      int msg = wParam.ToInt32();
      if (msg == WM_LBUTTONDOWN || msg == WM_LBUTTONUP ||
          msg == WM_RBUTTONDOWN || msg == WM_RBUTTONUP ||
          msg == WM_MOUSEWHEEL) {

        POINT pt = hookStruct.pt;

        // 1. Kiểm tra nếu con trỏ đang ở trong app Multi Launcher hoặc Multi Launcher đang là Foreground:
        // TUYỆT ĐỐI KHÔNG can thiệp, bỏ qua ngay lập tức để người dùng thao tác trong app bình thường!
        IntPtr wndUnder = WindowFromPoint(pt);
        IntPtr rootUnder = GetAncestor(wndUnder, GA_ROOT);
        if (rootUnder == IntPtr.Zero) rootUnder = wndUnder;

        IntPtr fgWnd = GetForegroundWindow();

        if (IsMultiLauncher(rootUnder) || IsMultiLauncher(fgWnd)) {
          return CallNextHookEx(_hookID, nCode, wParam, lParam);
        }

        // Cần ít nhất 2 cửa sổ để có thể đồng bộ
        if (TrackedHwnds.Count < 2) {
          return CallNextHookEx(_hookID, nCode, wParam, lParam);
        }

        // 2. Kiểm tra xem người dùng có click vào 1 trong các cửa sổ đang được theo dõi (TrackedHwnds) không?
        IntPtr masterHwnd = IntPtr.Zero;
        if (TrackedHwnds.Contains(rootUnder)) {
          masterHwnd = rootUnder;
        } else {
          foreach (IntPtr h in TrackedHwnds) {
            if (h == rootUnder) {
              masterHwnd = h;
              break;
            }
          }
        }

        // Nếu click ngoài các cửa sổ đích (ví dụ click Start menu, Taskbar, desktop, app khác): bỏ qua
        if (masterHwnd == IntPtr.Zero) {
          return CallNextHookEx(_hookID, nCode, wParam, lParam);
        }

        RECT masterRect;
        if (!IsWindow(masterHwnd) || !IsWindowVisible(masterHwnd) || IsIconic(masterHwnd) ||
            !GetWindowRect(masterHwnd, out masterRect) ||
            masterRect.Width <= 0 || masterRect.Height <= 0) {
          return CallNextHookEx(_hookID, nCode, wParam, lParam);
        }

        double relX = (double)(pt.x - masterRect.Left) / masterRect.Width;
        double relY = (double)(pt.y - masterRect.Top) / masterRect.Height;

        uint eventFlags = 0;
        if (msg == WM_LBUTTONDOWN) eventFlags = MOUSEEVENTF_LEFTDOWN;
        else if (msg == WM_LBUTTONUP) eventFlags = MOUSEEVENTF_LEFTUP;
        else if (msg == WM_RBUTTONDOWN) eventFlags = MOUSEEVENTF_RIGHTDOWN;
        else if (msg == WM_RBUTTONUP) eventFlags = MOUSEEVENTF_RIGHTUP;
        else if (msg == WM_MOUSEWHEEL) eventFlags = MOUSEEVENTF_WHEEL;

        _isSyncing = true;
        try {
          foreach (IntPtr slaveHwnd in TrackedHwnds) {
            if (slaveHwnd == masterHwnd) continue;
            if (!IsWindow(slaveHwnd) || !IsWindowVisible(slaveHwnd) || IsIconic(slaveHwnd)) continue;

            RECT slaveRect;
            if (GetWindowRect(slaveHwnd, out slaveRect) && slaveRect.Width > 0 && slaveRect.Height > 0) {
              int slaveX = slaveRect.Left + (int)(relX * slaveRect.Width);
              int slaveY = slaveRect.Top + (int)(relY * slaveRect.Height);

              SetCursorPos(slaveX, slaveY);
              mouse_event(eventFlags, 0, 0, hookStruct.mouseData, (UIntPtr)SYNC_MAGIC);
            }
          }
        } finally {
          SetCursorPos(pt.x, pt.y);
          SetForegroundWindow(masterHwnd);
          _isSyncing = false;
        }
      }
    }
    return CallNextHookEx(_hookID, nCode, wParam, lParam);
  }
}
"@

Add-Type -TypeDefinition $code -ReferencedAssemblies System.Windows.Forms

$count = [MouseSyncService]::StartHook($pattern, [uint32]$launcherPid)
Write-Output "READY: $count"

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 2000
$timer.add_Tick({
  [MouseSyncService]::RefreshWindows()
})
$timer.Start()

try {
  [System.Windows.Forms.Application]::Run()
} finally {
  $timer.Stop()
  $timer.Dispose()
  [MouseSyncService]::StopHook()
  Write-Output "STOPPED"
}
