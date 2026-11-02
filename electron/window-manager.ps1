param(
  [Parameter(Mandatory=$true)]
  [string]$action,
  [string]$pattern = '.*',
  [string]$layout = 'auto'
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Windows.Forms

$code = @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;

public class Win32WindowManager {
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc cb, IntPtr extra);
  [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
  [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool repaint);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);

  [DllImport("user32.dll", SetLastError = true)] public static extern IntPtr BeginDeferWindowPos(int nNumWindows);
  [DllImport("user32.dll", SetLastError = true)] public static extern IntPtr DeferWindowPos(IntPtr hWinPosInfo, IntPtr hWnd, IntPtr hWndInsertAfter, int x, int y, int cx, int cy, uint uFlags);
  [DllImport("user32.dll", SetLastError = true)] public static extern bool EndDeferWindowPos(IntPtr hWinPosInfo);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

  [StructLayout(LayoutKind.Sequential)]
  public struct RECT {
    public int Left;
    public int Top;
    public int Right;
    public int Bottom;
  }

  public static List<IntPtr> FindMatchingWindows(string pattern) {
    var wins = new List<IntPtr>();
    var sb = new StringBuilder(512);
    Regex reg = null;
    if (!string.IsNullOrEmpty(pattern) && pattern != ".*") {
      try {
        reg = new Regex(pattern, RegexOptions.IgnoreCase);
      } catch {}
    }

    EnumWindows((hWnd, lParam) => {
      if (IsWindow(hWnd) && IsWindowVisible(hWnd)) {
        sb.Length = 0;
        GetWindowText(hWnd, sb, sb.Capacity);
        string text = sb.ToString();
        if (!string.IsNullOrEmpty(text) && 
            text != "Program Manager" && 
            text.IndexOf("Multi Launcher", StringComparison.OrdinalIgnoreCase) < 0) {
          bool match = false;
          if (reg == null) {
            match = true;
          } else {
            match = reg.IsMatch(text);
          }
          if (!match && !string.IsNullOrEmpty(pattern)) {
            match = text.IndexOf(pattern, StringComparison.OrdinalIgnoreCase) >= 0;
          }
          if (match) {
            RECT r;
            if (GetWindowRect(hWnd, out r) && (r.Right - r.Left) > 80 && (r.Bottom - r.Top) > 60) {
              wins.Add(hWnd);
            }
          }
        }
      }
      return true;
    }, IntPtr.Zero);

    return wins;
  }

  public static void BatchMove(List<IntPtr> hwnds, List<int> xs, List<int> ys, List<int> ws, List<int> hs) {
    if (hwnds == null || hwnds.Count == 0) return;
    int n = hwnds.Count;

    for (int i = 0; i < n; i++) {
      if (IsIconic(hwnds[i])) {
        ShowWindow(hwnds[i], 9);
      }
    }

    uint flags = 0x0004 | 0x0040;
    IntPtr hdwp = BeginDeferWindowPos(n);
    if (hdwp != IntPtr.Zero) {
      for (int i = 0; i < n; i++) {
        hdwp = DeferWindowPos(hdwp, hwnds[i], IntPtr.Zero, xs[i], ys[i], ws[i], hs[i], flags);
        if (hdwp == IntPtr.Zero) break;
      }
      if (hdwp != IntPtr.Zero) {
        EndDeferWindowPos(hdwp);
        return;
      }
    }

    for (int i = 0; i < n; i++) {
      ShowWindow(hwnds[i], 9);
      MoveWindow(hwnds[i], xs[i], ys[i], ws[i], hs[i], true);
    }
  }
}
"@

if (-not ([System.Management.Automation.PSTypeName]'Win32WindowManager').Type) {
  Add-Type -TypeDefinition $code -ReferencedAssemblies System.Windows.Forms
}

$wins = [Win32WindowManager]::FindMatchingWindows($pattern)

if ($action -eq 'close') {
  $closed = 0
  foreach ($h in $wins) {
    [void][Win32WindowManager]::PostMessage($h, 0x0010, [IntPtr]::Zero, [IntPtr]::Zero)
    $closed++
  }
  Write-Output $closed
  exit 0
}

# Action is 'arrange'
$screen = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
$n = $wins.Count

if ($n -gt 0) {
  if ($layout -eq 'minimize') {
    foreach ($h in $wins) {
      [void][Win32WindowManager]::ShowWindow($h, 6)
    }
  } elseif ($layout -eq 'restore') {
    foreach ($h in $wins) {
      [void][Win32WindowManager]::ShowWindow($h, 9)
    }
  } elseif ($layout -eq 'split-2') {
    $colW = [Math]::Floor($screen.Width / 2)
    $xs = New-Object System.Collections.Generic.List[int]
    $ys = New-Object System.Collections.Generic.List[int]
    $ws = New-Object System.Collections.Generic.List[int]
    $hs = New-Object System.Collections.Generic.List[int]
    $hwnds = New-Object System.Collections.Generic.List[IntPtr]

    $applyCount = [Math]::Min($n, 2)
    for ($i = 0; $i -lt $applyCount; $i++) {
      $hwnds.Add($wins[$i])
      $xs.Add($screen.Left + ($i * $colW))
      $ys.Add($screen.Top)
      $wVal = if ($i -eq 1) { $screen.Width - $colW } else { $colW }
      $ws.Add($wVal)
      $hs.Add($screen.Height)
    }
    [Win32WindowManager]::BatchMove($hwnds, $xs, $ys, $ws, $hs)
  } elseif ($layout -eq 'split-3') {
    $colW = [Math]::Floor($screen.Width / 3)
    $xs = New-Object System.Collections.Generic.List[int]
    $ys = New-Object System.Collections.Generic.List[int]
    $ws = New-Object System.Collections.Generic.List[int]
    $hs = New-Object System.Collections.Generic.List[int]
    $hwnds = New-Object System.Collections.Generic.List[IntPtr]

    $applyCount = [Math]::Min($n, 3)
    for ($i = 0; $i -lt $applyCount; $i++) {
      $hwnds.Add($wins[$i])
      $xs.Add($screen.Left + ($i * $colW))
      $ys.Add($screen.Top)
      $wVal = if ($i -eq 2) { $screen.Width - ($colW * 2) } else { $colW }
      $ws.Add($wVal)
      $hs.Add($screen.Height)
    }
    [Win32WindowManager]::BatchMove($hwnds, $xs, $ys, $ws, $hs)
  } elseif ($layout -eq 'grid-2x2') {
    $halfW = [Math]::Floor($screen.Width / 2)
    $halfH = [Math]::Floor($screen.Height / 2)
    $positions = @(
      @{ X = $screen.Left; Y = $screen.Top; W = $halfW; H = $halfH },
      @{ X = $screen.Left + $halfW; Y = $screen.Top; W = $screen.Width - $halfW; H = $halfH },
      @{ X = $screen.Left; Y = $screen.Top + $halfH; W = $halfW; H = $screen.Height - $halfH },
      @{ X = $screen.Left + $halfW; Y = $screen.Top + $halfH; W = $screen.Width - $halfW; H = $screen.Height - $halfH }
    )
    $xs = New-Object System.Collections.Generic.List[int]
    $ys = New-Object System.Collections.Generic.List[int]
    $ws = New-Object System.Collections.Generic.List[int]
    $hs = New-Object System.Collections.Generic.List[int]
    $hwnds = New-Object System.Collections.Generic.List[IntPtr]

    $applyCount = [Math]::Min($n, 4)
    for ($i = 0; $i -lt $applyCount; $i++) {
      $pos = $positions[$i]
      $hwnds.Add($wins[$i])
      $xs.Add($pos.X)
      $ys.Add($pos.Y)
      $ws.Add($pos.W)
      $hs.Add($pos.H)
    }
    [Win32WindowManager]::BatchMove($hwnds, $xs, $ys, $ws, $hs)
  } elseif ($layout -eq 'grid-3x2') {
    $colW = [Math]::Floor($screen.Width / 3)
    $rowH = [Math]::Floor($screen.Height / 2)
    $xs = New-Object System.Collections.Generic.List[int]
    $ys = New-Object System.Collections.Generic.List[int]
    $ws = New-Object System.Collections.Generic.List[int]
    $hs = New-Object System.Collections.Generic.List[int]
    $hwnds = New-Object System.Collections.Generic.List[IntPtr]

    $applyCount = [Math]::Min($n, 6)
    for ($i = 0; $i -lt $applyCount; $i++) {
      $r = [Math]::Floor($i / 3)
      $c = $i % 3
      $hwnds.Add($wins[$i])
      $xs.Add($screen.Left + ($c * $colW))
      $ys.Add($screen.Top + ($r * $rowH))
      $wVal = if ($c -eq 2) { $screen.Width - ($colW * 2) } else { $colW }
      $hVal = if ($r -eq 1) { $screen.Height - $rowH } else { $rowH }
      $ws.Add($wVal)
      $hs.Add($hVal)
    }
    [Win32WindowManager]::BatchMove($hwnds, $xs, $ys, $ws, $hs)
  } else {
    # auto grid: tính toán kích thước tối ưu theo tỷ lệ màn hình
    $cols = [Math]::Ceiling([Math]::Sqrt($n))
    $rows = [Math]::Ceiling($n / $cols)
    $rowH = [Math]::Floor($screen.Height / $rows)

    $itemsPerRow = New-Object System.Collections.Generic.List[int]
    $rem = $n
    for ($r = 0; $r -lt $rows; $r++) {
      $rowsLeft = $rows - $r
      $c = [Math]::Ceiling($rem / $rowsLeft)
      $itemsPerRow.Add($c)
      $rem -= $c
    }

    $xs = New-Object System.Collections.Generic.List[int]
    $ys = New-Object System.Collections.Generic.List[int]
    $ws = New-Object System.Collections.Generic.List[int]
    $hs = New-Object System.Collections.Generic.List[int]
    $hwnds = New-Object System.Collections.Generic.List[IntPtr]

    $idx = 0
    for ($r = 0; $r -lt $rows; $r++) {
      $countInRow = $itemsPerRow[$r]
      $colW = [Math]::Floor($screen.Width / $countInRow)
      $y = $screen.Top + ($r * $rowH)
      $actualH = if ($r -eq ($rows - 1)) { $screen.Height - ($r * $rowH) } else { $rowH }

      for ($c = 0; $c -lt $countInRow; $c++) {
        if ($idx -lt $n) {
          $hwnds.Add($wins[$idx])
          $xs.Add($screen.Left + ($c * $colW))
          $ys.Add($y)
          $wVal = if ($c -eq ($countInRow - 1)) { $screen.Width - ($c * $colW) } else { $colW }
          $ws.Add($wVal)
          $hs.Add($actualH)
          $idx++
        }
      }
    }
    [Win32WindowManager]::BatchMove($hwnds, $xs, $ys, $ws, $hs)
  }
}

Write-Output $n
