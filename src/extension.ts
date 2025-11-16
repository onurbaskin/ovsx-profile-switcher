import * as vscode from "vscode";
import { selectProfileForWorkspace } from "./commands/selectProfile";
import { selectProfileForFolder } from "./commands/selectProfileForFolder";
import {
	applyProfileForActiveFile,
	applyProfileOnStartup,
} from "./utils/profileManager";

export function activate(context: vscode.ExtensionContext) {
	console.log("Profile Switcher extension is now active!");

	// Register commands
	const selectWorkspaceProfileCommand = vscode.commands.registerCommand(
		"profileSwitcher.selectProfile",
		selectProfileForWorkspace,
	);

	const selectFolderProfileCommand = vscode.commands.registerCommand(
		"profileSwitcher.selectProfileForFolder",
		selectProfileForFolder,
	);

	context.subscriptions.push(selectWorkspaceProfileCommand);
	context.subscriptions.push(selectFolderProfileCommand);

	// Apply profile on startup if auto-switch is enabled
	const config = vscode.workspace.getConfiguration("profileSwitcher");
	if (config.get<boolean>("autoSwitch", true)) {
		applyProfileOnStartup();
	}

	// Watch for workspace folder changes
	vscode.workspace.onDidChangeWorkspaceFolders(() => {
		if (config.get<boolean>("autoSwitch", true)) {
			applyProfileOnStartup();
		}
	});

	// Watch for active editor changes to apply directory-specific profiles
	vscode.window.onDidChangeActiveTextEditor(() => {
		if (config.get<boolean>("autoSwitch", true)) {
			applyProfileForActiveFile();
		}
	});
}

export function deactivate() {}

