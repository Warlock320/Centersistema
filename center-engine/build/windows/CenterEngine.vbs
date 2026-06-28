Set fso = CreateObject("Scripting.FileSystemObject")
installDir = fso.GetParentFolderName(WScript.ScriptFullName)
nodeExe = installDir & "\node\node.exe"
engineFile = installDir & "\engine.cjs"

If Not fso.FileExists(nodeExe) Then
    MsgBox "Node.js nao encontrado em:" & vbCrLf & nodeExe & vbCrLf & vbCrLf & "Execute o instalador novamente.", vbCritical, "CenterEngine"
    WScript.Quit
End If

If Not fso.FileExists(engineFile) Then
    MsgBox "Engine nao encontrado em:" & vbCrLf & engineFile & vbCrLf & vbCrLf & "Execute o instalador novamente.", vbCritical, "CenterEngine"
    WScript.Quit
End If

Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = installDir
WshShell.Run Chr(34) & nodeExe & Chr(34) & " " & Chr(34) & engineFile & Chr(34), 0, False
