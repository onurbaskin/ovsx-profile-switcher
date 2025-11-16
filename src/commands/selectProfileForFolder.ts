import * as vscode from "vscode";
import {
	updateDirectoryProfile,
	getRelativePathFromWorkspace,
} from "../utils/settingsManager";
import { getAvailableProfiles, switchToProfile } from "../utils/profileManager";

export async function selectProfileForFolder(folderUri?: vscode.Uri) {
	const workspaceFolders = vscode.workspace.workspaceFolders;

	if (!workspaceFolders || workspaceFolders.length === 0) {
		vscode.window.showErrorMessage("No workspace folder is open.");
		return;
	}

	let workspaceFolder: vscode.WorkspaceFolder;
	let relativePath: string;

	// If called from context menu with folderUri, use it
	if (folderUri) {
		const workspace = vscode.workspace.getWorkspaceFolder(folderUri);
		if (!workspace) {
			vscode.window.showErrorMessage(
				"Selected folder is not part of the workspace.",
			);
			return;
		}
		workspaceFolder = workspace;
		relativePath = getRelativePathFromWorkspace(
			workspace.uri.fsPath,
			folderUri.fsPath,
		);
	} else {
		// Called from command palette - ask for workspace folder first if multiple
		if (workspaceFolders.length === 1) {
			workspaceFolder = workspaceFolders[0];
		} else {
			const folderItems = workspaceFolders.map((folder) => ({
				label: folder.name,
				description: folder.uri.fsPath,
				folder: folder,
			}));

			const selected = await vscode.window.showQuickPick(folderItems, {
				placeHolder: "Select a workspace folder",
			});

			if (!selected) {
				return;
			}

			workspaceFolder = selected.folder;
		}

		// Ask for the relative path
		const pathInput = await vscode.window.showInputBox({
			prompt: "Enter the relative path from workspace root",
			placeHolder: "e.g., backend/, frontend/, src/components/",
			validateInput: (value) => {
				if (!value || value.trim().length === 0) {
					return "Path cannot be empty";
				}
				// Normalize path separators
				const normalized = value.replace(/\\/g, "/");
				if (!normalized.endsWith("/")) {
					return "Path should end with / for directories";
				}
				return null;
			},
		});

		if (!pathInput) {
			return;
		}

		// Normalize the path
		relativePath = pathInput.replace(/\\/g, "/");
		if (!relativePath.endsWith("/")) {
			relativePath += "/";
		}
	}

	const workspacePath = workspaceFolder.uri.fsPath;

	// Get available profiles and show dropdown
	const profiles = await getAvailableProfiles();

	// Always show dropdown - getAvailableProfiles should always return at least "Default"
	// But if somehow it's empty, show input box as fallback
	if (profiles.length === 0) {
		console.warn("No profiles found, showing input box as fallback");
		const profileName = await vscode.window.showInputBox({
			prompt: "Enter the profile name for this folder",
			placeHolder: "e.g., Default, Work, Personal",
		});

		if (!profileName) {
			return;
		}

		await updateDirectoryProfile(workspacePath, relativePath, profileName);
		vscode.window.showInformationMessage(
			`Profile "${profileName}" set for folder "${relativePath}". Please reload the window to apply.`,
		);
		return;
	}

	// Show profile selection dropdown
	const profileItems = profiles.map((profile) => ({
		label: profile,
		description: `Switch to ${profile} profile`,
	}));

	console.log("Showing profile quick pick with items:", profileItems.length);
	const selectedProfile = await vscode.window.showQuickPick(profileItems, {
		placeHolder: `Select a profile for ${relativePath}`,
		ignoreFocusOut: false,
	});

	if (!selectedProfile) {
		return;
	}

	await updateDirectoryProfile(
		workspacePath,
		relativePath,
		selectedProfile.label,
	);
	
	// Actually switch to the selected profile
	const switched = await switchToProfile(selectedProfile.label);
	if (switched) {
		vscode.window.showInformationMessage(
			`Switched to profile "${selectedProfile.label}" for folder "${relativePath}".`,
		);
	} else {
		vscode.window
			.showWarningMessage(
				`Profile "${selectedProfile.label}" saved for folder "${relativePath}", but failed to switch. Please reload the window to apply.`,
				"Reload Window",
			)
			.then((selection) => {
				if (selection === "Reload Window") {
					vscode.commands.executeCommand("workbench.action.reloadWindow");
				}
			});
	}
}

