# 安装位置与更新

本仓库构建的 stagewise pro 默认安装到 **E 盘**，不使用 Squirrel 默认的
`%LOCALAPPDATA%`（C 盘）安装目录。

## 安装程序（推荐）

安装包由 Inno Setup 生成，文件位于：

```text
apps/browser/out/release/make/inno/stagewise-pro-<版本>-x64-setup.exe
```

安装目录选择规则：

1. E 盘存在：默认 `E:\softs\stagewise-pro`；
2. E 盘不存在、C 盘存在：默认 `C:\softs\stagewise-pro`；
3. 两个盘都不可用：安装向导停留在目录选择页，由用户指定安装目录；
4. 任何情况下都可以在安装向导中手动修改安装位置。

安装完成后会创建开始菜单与桌面快捷方式，并在“应用和功能”中注册
“stagewise pro”卸载项。安装程序为当前用户安装，不需要管理员权限。

### 构建安装包

```powershell
cd apps/browser
$env:RELEASE_CHANNEL = "release"
$env:APP_VERSION_OVERRIDE = "1.31.27"
$env:BUILD_MODE = "production"
pnpm make --arch=x64
```

然后编译 Inno Setup 安装程序：

```powershell
$env:APP_VERSION_OVERRIDE = "1.31.27"
& "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe" installer\stagewise-pro.iss
```

## 便携安装（开发调试）

不经过安装程序时，可直接运行脚本复制到 E 盘：

```powershell
pwsh -File scripts/install-portable.ps1
```

脚本会校验目标位于 `E:\softs` 下、停止旧实例、复制程序并重建快捷方式，
不会修改 `%APPDATA%\stagewise` 中的用户数据。

## 目录约定

| 内容 | 路径 |
| --- | --- |
| 程序本体 | `E:\softs\stagewise-pro`（E 盘不可用时为 `C:\softs\stagewise-pro`） |
| 可执行文件 | `<安装目录>\stagewise-pro.exe` |
| 用户数据（会话、设置、模型配置、技能） | `%APPDATA%\stagewise` |
| 开始菜单快捷方式 | `%APPDATA%\Microsoft\Windows\Start Menu\Programs\stagewise pro.lnk` |
| 桌面快捷方式 | `%USERPROFILE%\Desktop\stagewise pro.lnk` |
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
