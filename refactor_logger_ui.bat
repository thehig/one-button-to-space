@echo on
setlocal

REM Define the base source directory relative to the workspace root
set SRC_DIR=packages\logger-ui\src

REM --- Create New Directory Structure ---
echo Creating new directories...
mkdir "%SRC_DIR%\components"
mkdir "%SRC_DIR%\components\GameEventLog"
mkdir "%SRC_DIR%\components\GameEventLogConfig"
mkdir "%SRC_DIR%\components\TreeNode"
mkdir "%SRC_DIR%\contexts"
mkdir "%SRC_DIR%\contexts\CommunicationContext"
mkdir "%SRC_DIR%\managers"
mkdir "%SRC_DIR%\managers\CommunicationManager"
mkdir "%SRC_DIR%\hooks\useComponentLayout"
mkdir "%SRC_DIR%\hooks\useEventFiltering"
mkdir "%SRC_DIR%\utils"
mkdir "%SRC_DIR%\utils\general"
mkdir "%SRC_DIR%\types"

REM --- Move and Rename Files ---
echo --- Moving files ---

REM Components
echo Moving GameEventLog.tsx...
move "%SRC_DIR%\GameEventLog.tsx" "%SRC_DIR%\components\GameEventLog\"
echo Moving GameEventLog.test.tsx...
move "%SRC_DIR%\GameEventLog.test.tsx" "%SRC_DIR%\components\GameEventLog\"
echo Moving GameEventLog.css to GameEventLog.module.css...
move "%SRC_DIR%\GameEventLog.css" "%SRC_DIR%\components\GameEventLog\GameEventLog.module.css"
echo Moving GameEventLogConfig.ts to GameEventLogConfig.tsx...
move "%SRC_DIR%\GameEventLogConfig.ts" "%SRC_DIR%\components\GameEventLogConfig\GameEventLogConfig.tsx"
echo Moving GameEventLogConfig.test.ts to GameEventLogConfig.test.tsx...
move "%SRC_DIR%\GameEventLogConfig.test.ts" "%SRC_DIR%\components\GameEventLogConfig\GameEventLogConfig.test.tsx"
echo Moving TreeNode.tsx...
move "%SRC_DIR%\TreeNode.tsx" "%SRC_DIR%\components\TreeNode\"
echo Moving TreeNode.test.tsx...
move "%SRC_DIR%\TreeNode.test.tsx" "%SRC_DIR%\components\TreeNode\"

REM Contexts
echo Moving CommunicationContext.tsx...
move "%SRC_DIR%\CommunicationContext.tsx" "%SRC_DIR%\contexts\CommunicationContext\"
echo Moving CommunicationContext.test.tsx...
move "%SRC_DIR%\CommunicationContext.test.tsx" "%SRC_DIR%\contexts\CommunicationContext\"

REM Managers
echo Moving CommunicationManager.ts...
move "%SRC_DIR%\CommunicationManager.ts" "%SRC_DIR%\managers\CommunicationManager\"
echo Moving CommunicationManager.test.ts...
move "%SRC_DIR%\CommunicationManager.test.ts" "%SRC_DIR%\managers\CommunicationManager\"

REM Hooks
echo Moving useComponentLayout.ts...
move "%SRC_DIR%\hooks\useComponentLayout.ts" "%SRC_DIR%\hooks\useComponentLayout\"
echo Moving useComponentLayout.test.tsx...
move "%SRC_DIR%\hooks\useComponentLayout.test.tsx" "%SRC_DIR%\hooks\useComponentLayout\"
echo Moving useEventFiltering.ts...
move "%SRC_DIR%\hooks\useEventFiltering.ts" "%SRC_DIR%\hooks\useEventFiltering\"
echo Moving useEventFiltering.test.tsx...
move "%SRC_DIR%\hooks\useEventFiltering.test.tsx" "%SRC_DIR%\hooks\useEventFiltering\"

REM Utils
echo Moving utils.ts...
move "%SRC_DIR%\utils.ts" "%SRC_DIR%\utils\general\"
echo Moving utils.test.ts...
move "%SRC_DIR%\utils.test.ts" "%SRC_DIR%\utils\general\"

REM Types
echo Moving types.ts...
move "%SRC_DIR%\types.ts" "%SRC_DIR%\types\"

REM Root src files remain

REM --- Create Basic index.ts Files ---
echo --- Creating index.ts files ---
echo Creating "%SRC_DIR%\components\GameEventLog\index.ts"...
echo. > "%SRC_DIR%\components\GameEventLog\index.ts"
echo Creating "%SRC_DIR%\components\GameEventLogConfig\index.ts"...
echo. > "%SRC_DIR%\components\GameEventLogConfig\index.ts"
echo Creating "%SRC_DIR%\components\TreeNode\index.ts"...
echo. > "%SRC_DIR%\components\TreeNode\index.ts"
echo Creating "%SRC_DIR%\contexts\CommunicationContext\index.ts"...
echo. > "%SRC_DIR%\contexts\CommunicationContext\index.ts"
echo Creating "%SRC_DIR%\contexts\index.ts"...
echo. > "%SRC_DIR%\contexts\index.ts"
echo Creating "%SRC_DIR%\managers\CommunicationManager\index.ts"...
echo. > "%SRC_DIR%\managers\CommunicationManager\index.ts"
echo Creating "%SRC_DIR%\managers\index.ts"...
echo. > "%SRC_DIR%\managers\index.ts"
echo Creating "%SRC_DIR%\hooks\useComponentLayout\index.ts"...
echo. > "%SRC_DIR%\hooks\useComponentLayout\index.ts"
echo Creating "%SRC_DIR%\hooks\useEventFiltering\index.ts"...
echo. > "%SRC_DIR%\hooks\useEventFiltering\index.ts"
echo Creating "%SRC_DIR%\hooks\index.ts"...
echo. > "%SRC_DIR%\hooks\index.ts"
echo Creating "%SRC_DIR%\utils\general\index.ts"...
echo. > "%SRC_DIR%\utils\general\index.ts"
echo Creating "%SRC_DIR%\utils\index.ts"...
echo. > "%SRC_DIR%\utils\index.ts"
echo Creating "%SRC_DIR%\types\index.ts"...
echo. > "%SRC_DIR%\types\index.ts"


echo Script finished. Please check the %SRC_DIR% directory.
echo Remember to update import paths in your code!

endlocal