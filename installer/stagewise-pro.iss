; stagewise pro 安装脚本（Inno Setup 6）
;
; 默认安装到 E:\softs\stagewise-pro；若 E 盘不存在则回退到 C:\softs\stagewise-pro；
; 两个盘都不可用时保留目录选择页，由用户指定安装位置。
;
; 编译：
;   $env:APP_VERSION_OVERRIDE="1.31.21"
;   & "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe" installer\stagewise-pro.iss

#define MyAppName "stagewise pro"
#define MyAppExeName "stagewise-pro.exe"
#define MyAppPublisher "stagewise Inc."
#define MyAppVersion GetEnv("APP_VERSION_OVERRIDE")

#if MyAppVersion == ""
  #define MyAppVersion "1.31.21"
#endif

[Setup]
AppId={{8E0E4F6B-6D2A-4B8E-9C2F-6E3D5A1B7C40}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName=E:\softs\stagewise-pro
DisableDirPage=no
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir=..\apps\browser\out\release\make\inno
OutputBaseFilename=stagewise-pro-{#MyAppVersion}-x64-setup
SetupIconFile=..\apps\browser\assets\icons\release\icon.ico
UninstallDisplayIcon={app}\{#MyAppExeName}
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
CloseApplications=yes
RestartApplications=no
MinVersion=10.0

[Languages]
Name: "zh"; MessagesFile: "compiler:Languages\ChineseSimplified.isl"
Name: "en"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "创建桌面快捷方式"; GroupDescription: "附加快捷方式:"; Languages: zh
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Additional shortcuts:"; Languages: en

[Files]
Source: "..\apps\browser\out\release\stagewise-pro-win32-x64\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "启动 {#MyAppName}"; Flags: nowait postinstall skipifsilent; Languages: zh
Filename: "{app}\{#MyAppExeName}"; Description: "Launch {#MyAppName}"; Flags: nowait postinstall skipifsilent; Languages: en

[Code]
procedure InitializeWizard();
begin
  { E 盘不存在时回退到 C 盘；两个盘都不可用时留空，让用户自行选择。 }
  if not DirExists('E:\') then
  begin
    if DirExists('C:\') then
      WizardForm.DirEdit.Text := 'C:\softs\stagewise-pro'
    else
      WizardForm.DirEdit.Text := '';
  end;
end;
