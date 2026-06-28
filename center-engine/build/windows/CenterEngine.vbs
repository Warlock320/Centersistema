Set WshShell = CreateObject("WScript.Shell")
installDir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
WshShell.Run """" & installDir & "\node\node.exe"" """ & installDir & "\engine.cjs""", 0, False
