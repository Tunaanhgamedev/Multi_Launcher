param(
  [string]$pattern = 'Chrome|Edge|CocCoc|browser'
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

  public static readonly IntPtr SYNC_MAGIC = (IntPtr)0x594E43; // 'SYNC' in hex

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

  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

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
  private static bool _isSyncing = false;
  private static long _lastRefreshTime = 0;

  public static void RefreshWindows() {
    List<IntPtr> list = new List<IntPtr>();
    EnumWindows((hWnd, lParam) => {
      if (IsWindowVisible(hWnd)) {
        StringBuilder sb = new StringBuilder(512);
        GetWindowText(hWnd, sb, sb.Capacity);
        string title = sb.ToString();
        if (!string.IsNullOrEmpty(title) &&
            !title.Contains("Multi Launcher") &&
            title != "Program Manager") {
          bool isMatch = false;
          try {
            isMatch = string.IsNullOrEmpty(TargetPattern) || TargetPattern == ".*" ||
                      Regex.IsMatch(title, TargetPattern, RegexOptions.IgnoreCase);
          } catch {
            isMatch = true;
          }
          if (isMatch) {
            RECT r;
            if (GetWindowRect(hWnd, out r) && r.Width > 120 && r.Height > 100) {
              list.Add(hWnd);
            }
          }
        }
      }
      return true;
    }, IntPtr.Zero);
    TrackedHwnds = list;
    _lastRefreshTime = Stopwatch.GetTimestamp();
  }

  public static int StartHook(string pattern) {
    TargetPattern = pattern;
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
      if (hookStruct.dwExtraInfo == SYNC_MAGIC) {
        return CallNextHookEx(_hookID, nCode, wParam, lParam);
      }

      int msg = wParam.ToInt32();
      if (msg == WM_LBUTTONDOWN || msg == WM_LBUTTONUP ||
          msg == WM_RBUTTONDOWN || msg == WM_RBUTTONUP ||
          msg == WM_MOUSEWHEEL) {

        int px = hookStruct.pt.x;
        int py = hookStruct.pt.y;

        // Làm mới danh sách cửa sổ mỗi 3 giây hoặc khi danh sách trống
        long now = Stopwatch.GetTimestamp();
        if (TrackedHwnds.Count == 0 || (now - _lastRefreshTime) / (double)Stopwatch.Frequency > 3.0) {
          RefreshWindows();
        }

        IntPtr masterHwnd = IntPtr.Zero;
        RECT masterRect = new RECT();

        foreach (IntPtr h in TrackedHwnds) {
          RECT r;
          if (IsWindowVisible(h) && GetWindowRect(h, out r)) {
            if (r.Contains(px, py)) {
              masterHwnd = h;
              masterRect = r;
              break;
            }
          }
        }

        // Nếu click xảy ra trong một cửa sổ thuộc danh sách, nhân bản sang tất cả các cửa sổ khác
        if (masterHwnd != IntPtr.Zero && masterRect.Width > 0 && masterRect.Height > 0) {
          double relX = (double)(px - masterRect.Left) / masterRect.Width;
          double relY = (double)(py - masterRect.Top) / masterRect.Height;

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

              RECT slaveRect;
              if (IsWindowVisible(slaveHwnd) && GetWindowRect(slaveHwnd, out slaveRect)) {
                int slaveX = slaveRect.Left + (int)(relX * slaveRect.Width);
                int slaveY = slaveRect.Top + (int)(relY * slaveRect.Height);

                SetCursorPos(slaveX, slaveY);
                mouse_event(eventFlags, 0, 0, hookStruct.mouseData, (UIntPtr)0x594E43);
              }
            }
          } finally {
            SetCursorPos(px, py);
            _isSyncing = false;
          }
        }
      }
    }
    return CallNextHookEx(_hookID, nCode, wParam, lParam);
  }
}
"@

Add-Type -TypeDefinition $code -ReferencedAssemblies System.Windows.Forms

$count = [MouseSyncService]::StartHook($pattern)
Write-Output "READY: $count"

try {
  [System.Windows.Forms.Application]::Run()
} finally {
  [MouseSyncService]::StopHook()
  Write-Output "STOPPED"
}
