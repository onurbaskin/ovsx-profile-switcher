# Profile Switcher

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![VS Code Version](https://img.shields.io/badge/VS%20Code-1.106.0+-blue.svg)](https://code.visualstudio.com/)

> **⚠️ Project Status: Paused**
> 
> This extension is currently **paused** because the VS Code Extensions API does not yet support programmatically switching profiles. The required API functionality is not available at this time.
> 
> As soon as VS Code provides the necessary API support for profile switching, I will resume development and publish this extension. Until then, the project remains on hold.
> 
> Thank you for your interest, and I'll update this notice once the API becomes available!

---

Automatically switches VS Code profiles based on your workspace settings. Just define your preferred profile in `.vscode/settings.json`, and it'll switch automatically every time you open the project.

## Features

- 🎯 **Workspace Profile Selection**: Set a profile for your entire workspace
- 📁 **Folder-Specific Profiles**: Configure different profiles for different folders in monorepos
- 🔄 **Auto-Switch**: Automatically applies the configured profile when opening a workspace
- 🎨 **Easy Configuration**: Simple commands to set up profiles

## Installation

1. Open VS Code Extensions view (`Cmd+Shift+X` / `Ctrl+Shift+X`)
2. Search for "Profile Switcher"
3. Click Install

Or install from the [Open VSX Registry](https://open-vsx.org/extension/onurbaskin/profile-switcher)

## Configuration

### Setting a Profile for a Workspace

1. Open the Command Palette (`Cmd+Shift+P` on macOS, `Ctrl+Shift+P` on Windows/Linux)
2. Run the command: **"Profile Switcher: Select Profile for Workspace"**
3. Choose a profile from the list or enter a custom profile name
4. Reload the window when prompted

The extension will create or update `.vscode/settings.json` in your workspace root with:

```json
{
  "profileSwitcher.workspaceProfile": "YourProfileName"
}
```

### Setting a Profile for a Specific Folder (Monorepo Support)

1. Right-click on a folder in the Explorer
2. Select **"Profile Switcher: Select Profile for Folder"**
3. Choose a profile from the list
4. Reload the window when prompted

This adds the folder path to the `profileSwitcher.directoryProfiles` setting, allowing different parts of your monorepo to use different profiles.

### Settings

Add to your `.vscode/settings.json`:

```json
{
  "profileSwitcher.autoSwitch": true,
  "profileSwitcher.workspaceProfile": "default",
  "profileSwitcher.directoryProfiles": {
    "backend/": "python",
    "frontend/": "javascript/typescript",
    "some/relative/path/": "someVSCodeProfileName"
  }
}
```

**Settings explained:**
- `profileSwitcher.autoSwitch` (boolean, default: `true`): Automatically switch profile on workspace open and when navigating between files
- `profileSwitcher.workspaceProfile` (string): VS Code profile to use for the entire workspace. Takes precedence over directory profiles.
- `profileSwitcher.directoryProfiles` (object): Map of relative directory paths to VS Code profile names. Paths should be relative to the workspace root and end with `/`. The most specific matching path will be used when opening files.

## Usage

- **Auto-Switch**: By default, the extension automatically switches to the configured profile when you open a workspace. Disable this in settings if needed.
- **Manual Commands**: Use the Command Palette to select profiles:
  - **Profile Switcher: Select Profile for Workspace**
  - **Profile Switcher: Select Profile for Folder** (also available via Explorer context menu)

## Development

### Prerequisites

- VS Code 1.106.0+
- Bun (or Node.js 18+ with npm)

### Setup

```bash
git clone https://github.com/onurbaskin/ovsx-profile-switcher.git
cd ovsx-profile-switcher
bun install
bun run compile
code .
```

Press `F5` to launch Extension Development Host.

### Scripts

```bash
bun run compile  # Compile TypeScript
bun run watch     # Watch mode
bun run publish   # Publish to Open VSX
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Commit and push (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Follow existing code style, add comments for complex logic, and test thoroughly.

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with [VS Code Extension API](https://code.visualstudio.com/api)
- Powered by [TypeScript](https://www.typescriptlang.org/) and [Bun](https://bun.sh/)
