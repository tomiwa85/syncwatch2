Unicode true
!include "MUI2.nsh"

!define APPNAME    "SyncWatch"
!define COMPANY    "SyncWatch"
!define APPVERSION "1.0.0"
!define EXENAME    "SyncWatch.exe"
!define SOURCE     "C:\Users\Olatomiwa Ojo\Documents\tomiwa\personal\apps\syncwatch\packages\client\release\win-unpacked"
!define SCRATCH    "C:\Users\Olatomiwa Ojo\Documents\tomiwa\personal\apps\syncwatch\packages\client\installer"
!define UNINSTKEY  "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}"

Name "${APPNAME} ${APPVERSION}"
OutFile "C:\Users\Olatomiwa Ojo\Documents\tomiwa\personal\apps\syncwatch\packages\client\release\SyncWatch-Setup-${APPVERSION}.exe"

; Per-user install — no administrator rights required.
RequestExecutionLevel user
InstallDir "$LOCALAPPDATA\Programs\${APPNAME}"
InstallDirRegKey HKCU "Software\${APPNAME}" "InstallDir"
SetCompressor /SOLID lzma

VIProductVersion "1.0.0.0"
VIAddVersionKey "ProductName" "${APPNAME}"
VIAddVersionKey "FileDescription" "${APPNAME} Setup"
VIAddVersionKey "LegalCopyright" "Copyright (c) 2026 ${COMPANY}"
VIAddVersionKey "FileVersion" "${APPVERSION}"
VIAddVersionKey "ProductVersion" "${APPVERSION}"

!define MUI_ICON "${SCRATCH}\appicon.ico"
!define MUI_UNICON "${SCRATCH}\appicon.ico"
!define MUI_ABORTWARNING

!define MUI_WELCOMEPAGE_TITLE "Welcome to the ${APPNAME} Setup"
!define MUI_WELCOMEPAGE_TEXT "This will install ${APPNAME} on your computer — everything it needs is included, so there's nothing else to download.$\r$\n$\r$\nClick Next to continue."

!define MUI_FINISHPAGE_RUN "$INSTDIR\${EXENAME}"
!define MUI_FINISHPAGE_RUN_TEXT "Launch ${APPNAME} now"

; ---- Installer pages ----
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "${SCRATCH}\LICENSE.txt"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

; ---- Uninstaller pages ----
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"

Section "Install"
  SetOutPath "$INSTDIR"
  File /r "${SOURCE}\*.*"

  ; Shortcuts
  CreateShortcut "$DESKTOP\${APPNAME}.lnk" "$INSTDIR\${EXENAME}"
  CreateDirectory "$SMPROGRAMS\${APPNAME}"
  CreateShortcut "$SMPROGRAMS\${APPNAME}\${APPNAME}.lnk" "$INSTDIR\${EXENAME}"
  CreateShortcut "$SMPROGRAMS\${APPNAME}\Uninstall ${APPNAME}.lnk" "$INSTDIR\Uninstall.exe"

  ; Uninstaller + Add/Remove Programs entry (per-user)
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  WriteRegStr HKCU "Software\${APPNAME}" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "${UNINSTKEY}" "DisplayName" "${APPNAME}"
  WriteRegStr HKCU "${UNINSTKEY}" "DisplayVersion" "${APPVERSION}"
  WriteRegStr HKCU "${UNINSTKEY}" "Publisher" "${COMPANY}"
  WriteRegStr HKCU "${UNINSTKEY}" "DisplayIcon" "$INSTDIR\${EXENAME}"
  WriteRegStr HKCU "${UNINSTKEY}" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegDWORD HKCU "${UNINSTKEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINSTKEY}" "NoRepair" 1
SectionEnd

Section "Uninstall"
  Delete "$DESKTOP\${APPNAME}.lnk"
  RMDir /r "$SMPROGRAMS\${APPNAME}"
  DeleteRegKey HKCU "${UNINSTKEY}"
  DeleteRegKey HKCU "Software\${APPNAME}"
  ; Remove the install dir (incl. the running uninstaller) via a detached shell
  ; after this process exits, so nothing is left behind — no admin needed.
  SetOutPath "$TEMP"
  Exec '"$SYSDIR\cmd.exe" /c ping -n 3 127.0.0.1 >nul & rmdir /s /q "$INSTDIR"'
SectionEnd
