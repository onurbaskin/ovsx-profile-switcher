import * as vscode from 'vscode';
import * as path from 'path';
import { updateDirectoryProfile, getRelativePathFromWorkspace } from '../utils/settingsManager';
import { getAvailableProfiles } from '../utils/profileManager';

export async function selectProfileForFolder(folderUri: vscode.Uri) {
	if (!folderUri) {
		vscode.window.showErrorMessage('No folder selected.');
		return;
	}

	const folderPath = folderUri.fsPath;

	// Find the workspace folder that contains this path
	const workspaceFolder = vscode.workspace.getWorkspaceFolder(folderUri);
	if (!workspaceFolder) {
		vscode.window.showErrorMessage('Selected folder is not part of the workspace.');
		return;
	}

	const workspacePath = workspaceFolder.uri.fsPath;
	const relativePath = getRelativePathFromWorkspace(workspacePath, folderPath);

	// Get available profiles
	const profiles = await getAvailableProfiles();
	
	if (profiles.length === 0) {
		const profileName = await vscode.window.showInputBox({
			prompt: 'Enter the profile name for this folder',
			placeHolder: 'e.g., Default, Work, Personal'
		});

		if (!profileName) {
			return;
		}

		await updateDirectoryProfile(workspacePath, relativePath, profileName);
		vscode.window.showInformationMessage(`Profile "${profileName}" set for folder "${relativePath}". Please reload the window to apply.`);
		return;
	}

	// Show profile selection
	const profileItems = profiles.map(profile => ({
		label: profile,
		description: `Switch to ${profile} profile`
	}));

	const selectedProfile = await vscode.window.showQuickPick(profileItems, {
		placeHolder: `Select a profile for ${relativePath}`
	});

	if (!selectedProfile) {
		return;
	}

	await updateDirectoryProfile(workspacePath, relativePath, selectedProfile.label);
	vscode.window.showInformationMessage(
		`Profile "${selectedProfile.label}" set for folder "${relativePath}". Please reload the window to apply.`,
		'Reload Window'
	).then(selection => {
		if (selection === 'Reload Window') {
			vscode.commands.executeCommand('workbench.action.reloadWindow');
		}
	});
}

