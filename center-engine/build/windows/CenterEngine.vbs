Set fso = CreateObject("Scripting.FileSystemObject")
Set WshShell = CreateObject("WScript.Shell")
installDir = fso.GetParentFolderName(WScript.ScriptFullName)

nodeExe = installDir & "\node\node.exe"
engineFile = installDir & "\engine.cjs"
trayScript = installDir & "\tray.ps1"
configFile = WshShell.ExpandEnvironmentStrings("%USERPROFILE%") & "\.center-engine\config.json"

' Verificar se o engine já está rodando (porta 9090)
On Error Resume Next
Set http = CreateObject("MSXML2.XMLHTTP")
http.Open "GET", "http://127.0.0.1:9090/ping", False
http.Send
engineRunning = (http.Status = 200)
On Error GoTo 0

If engineRunning Then
    ' Já está rodando — só abre o navegador
    systemUrl = GetSystemUrl(configFile)
    WshShell.Run systemUrl, 1, False
    WScript.Quit
End If

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
WScript.Sleep 3000

' Iniciar ícone na bandeja (tray)
If fso.FileExists(trayScript) Then
    WshShell.Run "powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File " & Chr(34) & trayScript & Chr(34), 0, False
End If

' Abrir navegador
systemUrl = GetSystemUrl(configFile)
WshShell.Run systemUrl, 1, False

Function GetSystemUrl(cfgPath)
    GetSystemUrl = "http://127.0.0.1:9090"
    If fso.FileExists(cfgPath) Then
        Set f = fso.OpenTextFile(cfgPath, 1)
        content = f.ReadAll
        f.Close
        ' Extrair systemUrl do JSON (simples, sem parser)
        pos = InStr(content, """systemUrl""")
        If pos > 0 Then
            pos2 = InStr(pos, content, "http")
            If pos2 > 0 Then
                pos3 = InStr(pos2, content, """")
                If pos3 > 0 Then
                    url = Mid(content, pos2, pos3 - pos2)
                    If Len(url) > 5 Then GetSystemUrl = url
                End If
            End If
        End If
    End If
End Function
