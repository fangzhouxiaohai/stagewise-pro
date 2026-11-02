# 安装位置与更新

本仓库构建的 stagewise pro 安装到 **E 盘**，不使用 Squirrel 默认的
`%LOCALAPPDATA%`（C 盘）安装目录。

## 目录约定

| 内容 | 路径 |
| --- | --- |
| 程序本体 | `E:\softs\stagewise-pro` |
| 可执行文件 | `E:\softs\stagewise-pro\stagewise-pro.exe` |
| 用户数据（会话、设置、模型配置、技能） | `%APPDATA%\stagewise` |
| 开始菜单快捷方式 | `%APPDATA%\Microsoft\Windows\Start Menu\Programs\stagewise pro.lnk` |
| 桌面快捷方式 | `%USERPROFILE%\Desktop\stagewise pro.lnk` |

用户数据保留在 `%APPDATA%\stagewise` 是为了品牌更名后仍能延续原有会话与设置；
它不属于“安装目录”，删除程序本体不会影响数据。

## 安装 / 更新

先构建打包产物：

```powershell
cd apps/browser
$env:RELEASE_CHANNEL = "release"
$env:APP_VERSION_OVERRIDE = "1.31.20"
$env:BUILD_MODE = "production"
pnpm make --arch=x64
```

再运行安装脚本（自动复制到 E 盘并创建快捷方式）：

```powershell
pwsh -File scripts/install-portable.ps1
```

脚本会：

1. 校验目标路径必须位于 `E:\softs\` 下；
2. 停止从目标目录运行的旧实例；
3. 删除并重新复制 `E:\softs\stagewise-pro`；
4. 创建开始菜单与桌面快捷方式；
5. 全程不触碰 `%APPDATA%\stagewise` 用户数据。

可选参数：

```powershell
pwsh -File scripts/install-portable.ps1 -Target "E:\softs\stagewise-pro" -SkipShortcuts
```

## 卸载

```powershell
Get-Process stagewise-pro -ErrorAction SilentlyContinue | Stop-Process -Force
Remove-Item -Recurse -Force "E:\softs\stagewise-pro"
Remove-Item "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\stagewise pro.lnk" -ErrorAction SilentlyContinue
Remove-Item "$env:USERPROFILE\Desktop\stagewise pro.lnk" -ErrorAction SilentlyContinue
```

如需彻底清除用户数据，再删除 `%APPDATA%\stagewise`。

## 为什么不用 Squirrel 安装包

Electron Forge 的 Squirrel.Windows 安装器固定安装到 `%LOCALAPPDATA%\<应用名>`，
无法通过参数指定 E 盘。为了满足“只装 E 盘”的要求，本项目改用便携目录 +
快捷方式的安装方式；Squirrel 安装包仍会由构建流程生成，但不再作为本机安装方式。
