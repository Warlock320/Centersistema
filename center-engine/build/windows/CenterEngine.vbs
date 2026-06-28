Set fso = CreateObject("Scripting.FileSystemObject")
Set WshShell = CreateObject("WScript.Shell")
installDir = fso.GetParentFolderName(WScript.ScriptFullName)

nodeExe = installDir & "\node\node.exe"
engineFile = installDir & "\engine.cjs"
trayScript = installDir & "\tray.ps1"

' Verificar se arquivos existem
If Not fso.FileExists(nodeExe) Then
    MsgBox "Node.js nao encontrado." & vbCrLf & "Execute o instalador novamente.", vbCritical, "CenterEngine"
    WScript.Quit
End If

If Not fso.FileExists(engineFile) Then
    MsgBox "Engine nao encontrado." & vbCrLf & "Execute o instalador novamente.", vbCritical, "CenterEngine"
    WScript.Quit
End If

' Iniciar engine Node.js (invisível)
WshShell.CurrentDirectory = installDir
WshShell.Run Chr(34) & nodeExe & Chr(34) & " " & Chr(34) & engineFile & Chr(34), 0, False

' Aguardar engine subir
WScript.Sleep 2000

' Iniciar ícone na bandeja (tray)
If fso.FileExists(trayScript) Then
    WshShell.Run "powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File " & Chr(34) & trayScript & Chr(34), 0, False
End If
