import * as vscode from 'vscode';
import { updateWorkspaceProfile } from '../utils/settingsManager';
import { getAvailableProfiles } from '../utils/profileManager';

export async function selectProfileForWorkspace() {
	const workspaceFolders = vscode.workspace.workspaceFolders;
	
	if (!workspaceFolders || workspaceFolders.length === 0) {
		vscode.window.showErrorMessage('No workspace folder is open.');
		return;
	}

	// For multi-root workspaces, let user choose which folder
	let targetFolder: vscode.WorkspaceFolder;
	if (workspaceFolders.length === 1) {
		targetFolder = workspaceFolders[0];
	} else {
		const folderItems = workspaceFolders.map(folder => ({
			label: folder.name,
			description: folder.uri.fsPath,
			folder: folder
		}));

		const selected = await vscode.window.showQuickPick(folderItems, {
			placeHolder: 'Select a workspace folder to configure'
		});

		if (!selected) {
			return;
		}

		targetFolder = selected.folder;
	}

	// Get available profiles
	const profiles = await getAvailableProfiles();
	
	if (profiles.length === 0) {
		const profileName = await vscode.window.showInputBox({
			prompt: 'Enter the profile name',
			placeHolder: 'e.g., Default, Work, Personal'
		});

		if (!profileName) {
			return;
		}

		await updateWorkspaceProfile(targetFolder.uri.fsPath, profileName);
		vscode.window.showInformationMessage(`Profile "${profileName}" set for workspace. Please reload the window to apply.`);
		return;
	}

	// Show profile selection
	const profileItems = profiles.map(profile => ({
		label: profile,
		description: `Switch to ${profile} profile`
	}));

	const selectedProfile = await vscode.window.showQuickPick(profileItems, {
		placeHolder: 'Select a profile for this workspace'
	});

	if (!selectedProfile) {
		return;
	}

	await updateWorkspaceProfile(targetFolder.uri.fsPath, selectedProfile.label);
	vscode.window.showInformationMessage(
		`Profile "${selectedProfile.label}" set for workspace. Please reload the window to apply.`,
		'Reload Window'
	).then(selection => {
		if (selection === 'Reload Window') {
			vscode.commands.executeCommand('workbench.action.reloadWindow');
		}
	});
}

