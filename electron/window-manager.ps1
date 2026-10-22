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
}
"@

if (-not ([System.Management.Automation.PSTypeName]'Win32WindowManager').Type) {
  Add-Type -TypeDefinition $code -ReferencedAssemblies System.Windows.Forms
}

$wins = New-Object System.Collections.Generic.List[System.IntPtr]
$pat = $pattern

[void][Win32WindowManager]::EnumWindows({
  param($h, $l)
  if ([Win32WindowManager]::IsWindow($h) -and [Win32WindowManager]::IsWindowVisible($h)) {
    $sb = New-Object System.Text.StringBuilder 512
    [void][Win32WindowManager]::GetWindowText($h, $sb, $sb.Capacity)
    $text = $sb.ToString()
    if ($text -and ($text -notmatch 'Multi Launcher') -and ($text -notmatch '^Program Manager$')) {
      $isMatch = $false
      try {
        if (-not $pat -or $pat -eq '.*') {
          $isMatch = $true
        } else {
          $isMatch = [System.Text.RegularExpressions.Regex]::IsMatch($text, $pat, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
        }
      } catch {
        $isMatch = $text.ToLower().Contains($pat.ToLower())
      }
      if ($isMatch) {
        $wins.Add($h)
      }
    }
  }
  return $true
}, [IntPtr]::Zero)

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
    for ($i = 0; $i -lt [Math]::Min($n, 2); $i++) {
      $x = $screen.Left + ($i * $colW)
      $w = if ($i -eq 1) { $screen.Width - $colW } else { $colW }
      [void][Win32WindowManager]::ShowWindow($wins[$i], 9)
      [void][Win32WindowManager]::MoveWindow($wins[$i], $x, $screen.Top, $w, $screen.Height, $true)
    }
  } elseif ($layout -eq 'split-3') {
    $colW = [Math]::Floor($screen.Width / 3)
    for ($i = 0; $i -lt [Math]::Min($n, 3); $i++) {
      $x = $screen.Left + ($i * $colW)
      $w = if ($i -eq 2) { $screen.Width - ($colW * 2) } else { $colW }
      [void][Win32WindowManager]::ShowWindow($wins[$i], 9)
      [void][Win32WindowManager]::MoveWindow($wins[$i], $x, $screen.Top, $w, $screen.Height, $true)
    }
  } elseif ($layout -eq 'grid-2x2') {
    $halfW = [Math]::Floor($screen.Width / 2)
    $halfH = [Math]::Floor($screen.Height / 2)
    $positions = @(
      @{ X = $screen.Left; Y = $screen.Top; W = $halfW; H = $halfH },
      @{ X = $screen.Left + $halfW; Y = $screen.Top; W = $screen.Width - $halfW; H = $halfH },
      @{ X = $screen.Left; Y = $screen.Top + $halfH; W = $halfW; H = $screen.Height - $halfH },
      @{ X = $screen.Left + $halfW; Y = $screen.Top + $halfH; W = $screen.Width - $halfW; H = $screen.Height - $halfH }
    )
    for ($i = 0; $i -lt [Math]::Min($n, 4); $i++) {
      $pos = $positions[$i]
      [void][Win32WindowManager]::ShowWindow($wins[$i], 9)
      [void][Win32WindowManager]::MoveWindow($wins[$i], $pos.X, $pos.Y, $pos.W, $pos.H, $true)
    }
  } elseif ($layout -eq 'grid-3x2') {
    $colW = [Math]::Floor($screen.Width / 3)
    $rowH = [Math]::Floor($screen.Height / 2)
    for ($i = 0; $i -lt [Math]::Min($n, 6); $i++) {
      $r = [Math]::Floor($i / 3)
      $c = $i % 3
      $x = $screen.Left + ($c * $colW)
      $y = $screen.Top + ($r * $rowH)
      $w = if ($c -eq 2) { $screen.Width - ($colW * 2) } else { $colW }
      $h = if ($r -eq 1) { $screen.Height - $rowH } else { $rowH }
      [void][Win32WindowManager]::ShowWindow($wins[$i], 9)
      [void][Win32WindowManager]::MoveWindow($wins[$i], $x, $y, $w, $h, $true)
    }
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

    $idx = 0
    for ($r = 0; $r -lt $rows; $r++) {
      $countInRow = $itemsPerRow[$r]
      $colW = [Math]::Floor($screen.Width / $countInRow)
      $y = $screen.Top + ($r * $rowH)
      $actualH = if ($r -eq ($rows - 1)) { $screen.Height - ($r * $rowH) } else { $rowH }

      for ($c = 0; $c -lt $countInRow; $c++) {
        if ($idx -lt $n) {
          $x = $screen.Left + ($c * $colW)
          $actualW = if ($c -eq ($countInRow - 1)) { $screen.Width - ($c * $colW) } else { $colW }
          $h = $wins[$idx]
          [void][Win32WindowManager]::ShowWindow($h, 9)
          [void][Win32WindowManager]::MoveWindow($h, $x, $y, $actualW, $actualH, $true)
          $idx++
        }
      }
    }
  }
}

Write-Output $n
