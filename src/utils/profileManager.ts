import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { getWorkspaceProfile, getDirectoryProfiles, getProfileForPath } from './settingsManager';

/**
 * Gets available VS Code profiles from the user's profile directory
 */
export async function getAvailableProfiles(): Promise<string[]> {
	const profiles: string[] = [];

	try {
		// VS Code stores profiles in different locations based on OS
		const userDataPath = getVSCodeUserDataPath();
		if (!userDataPath) {
			return profiles;
		}

		const profilesPath = path.join(userDataPath, 'User', 'profiles');
		
		if (fs.existsSync(profilesPath)) {
			const entries = fs.readdirSync(profilesPath, { withFileTypes: true });
			for (const entry of entries) {
				if (entry.isDirectory()) {
					// Profile directories are named with the profile name
					profiles.push(entry.name);
				}
			}
		}

		// Also check for the default profile
		// The default profile might not have a separate directory
		if (profiles.length === 0 || !profiles.includes('Default')) {
			profiles.unshift('Default');
		}
	} catch (error) {
		console.error('Error reading profiles:', error);
	}

	return profiles.sort();
}

/**
 * Gets the VS Code user data path based on the OS
 */
function getVSCodeUserDataPath(): string | null {
	const platform = process.platform;
	let basePath: string;

	switch (platform) {
		case 'darwin':
			basePath = path.join(os.homedir(), 'Library', 'Application Support', 'Code');
			break;
		case 'win32':
			basePath = path.join(os.homedir(), 'AppData', 'Roaming', 'Code');
			break;
		case 'linux':
			basePath = path.join(os.homedir(), '.config', 'Code');
			break;
		default:
			return null;
	}

	// Check if the path exists
	if (fs.existsSync(basePath)) {
		return basePath;
	}

	// Try with -Insiders suffix
	const insidersPath = basePath + '-Insiders';
	if (fs.existsSync(insidersPath)) {
		return insidersPath;
	}

	return null;
}

/**
 * Applies the profile configured in workspace settings on startup
 */
export async function applyProfileOnStartup(): Promise<void> {
	const workspaceFolders = vscode.workspace.workspaceFolders;
	
	if (!workspaceFolders || workspaceFolders.length === 0) {
		return;
	}

	// Check workspace-level profile first
	for (const folder of workspaceFolders) {
		const workspacePath = folder.uri.fsPath;
		
		// Get workspace profile from VS Code configuration (reads from .vscode/settings.json)
		const config = vscode.workspace.getConfiguration('profileSwitcher', folder.uri);
		const workspaceProfile = config.get<string>('workspaceProfile');
		
		if (workspaceProfile) {
			const currentProfile = vscode.workspace.getConfiguration('workbench').get<string>('profile');
			
			if (currentProfile !== workspaceProfile) {
				await vscode.workspace.getConfiguration('workbench').update(
					'profile',
					workspaceProfile,
					vscode.ConfigurationTarget.Workspace
				);
				
				vscode.window.showInformationMessage(
					`Switching to profile "${workspaceProfile}" for this workspace.`,
					'Reload Window'
				).then(selection => {
					if (selection === 'Reload Window') {
						vscode.commands.executeCommand('workbench.action.reloadWindow');
					}
				});
				return; // Workspace profile takes precedence
			}
		}
	}

	// Check directory-specific profiles if active editor exists
	const activeEditor = vscode.window.activeTextEditor;
	if (activeEditor) {
		const activeFilePath = activeEditor.document.uri.fsPath;
		
		// Find which workspace folder this file belongs to
		const workspaceFolder = vscode.workspace.getWorkspaceFolder(activeEditor.document.uri);
		if (workspaceFolder) {
			const workspacePath = workspaceFolder.uri.fsPath;
			
			// Get directory profiles from configuration
			const config = vscode.workspace.getConfiguration('profileSwitcher', workspaceFolder.uri);
			const directoryProfiles = config.get<Record<string, string>>('directoryProfiles', {});
			
			// Find the most specific matching directory profile
			let bestMatch: { path: string; profile: string } | undefined;
			const relativePath = path.relative(workspacePath, activeFilePath).replace(/\\/g, '/') + '/';
			
			for (const [dirPath, profile] of Object.entries(directoryProfiles)) {
				const normalizedDirPath = dirPath.endsWith('/') ? dirPath : dirPath + '/';
				
				if (relativePath.startsWith(normalizedDirPath)) {
					if (!bestMatch || normalizedDirPath.length > bestMatch.path.length) {
						bestMatch = { path: normalizedDirPath, profile };
					}
				}
			}
			
			if (bestMatch) {
				const currentProfile = vscode.workspace.getConfiguration('workbench').get<string>('profile');
				
				if (currentProfile !== bestMatch.profile) {
					await vscode.workspace.getConfiguration('workbench').update(
						'profile',
						bestMatch.profile,
						vscode.ConfigurationTarget.Workspace
					);
					
					vscode.window.showInformationMessage(
						`Switching to profile "${bestMatch.profile}" for directory "${bestMatch.path}".`,
						'Reload Window'
					).then(selection => {
						if (selection === 'Reload Window') {
							vscode.commands.executeCommand('workbench.action.reloadWindow');
						}
					});
				}
			}
		}
	}
}

/**
 * Applies profile when switching between files (called on document change)
 */
export async function applyProfileForActiveFile(): Promise<void> {
	const activeEditor = vscode.window.activeTextEditor;
	if (!activeEditor) {
		return;
	}

	const workspaceFolder = vscode.workspace.getWorkspaceFolder(activeEditor.document.uri);
	if (!workspaceFolder) {
		return;
	}

	const workspacePath = workspaceFolder.uri.fsPath;
	const config = vscode.workspace.getConfiguration('profileSwitcher', workspaceFolder.uri);
	
	// Check workspace profile first
	const workspaceProfile = config.get<string>('workspaceProfile');
	if (workspaceProfile) {
		const currentProfile = vscode.workspace.getConfiguration('workbench').get<string>('profile');
		if (currentProfile !== workspaceProfile) {
			await vscode.workspace.getConfiguration('workbench').update(
				'profile',
				workspaceProfile,
				vscode.ConfigurationTarget.Workspace
			);
			return;
		}
	}

	// Check directory profiles
	const directoryProfiles = config.get<Record<string, string>>('directoryProfiles', {});
	const activeFilePath = activeEditor.document.uri.fsPath;
	const relativePath = path.relative(workspacePath, activeFilePath).replace(/\\/g, '/') + '/';
	
	let bestMatch: { path: string; profile: string } | undefined;
	
	for (const [dirPath, profile] of Object.entries(directoryProfiles)) {
		const normalizedDirPath = dirPath.endsWith('/') ? dirPath : dirPath + '/';
		
		if (relativePath.startsWith(normalizedDirPath)) {
			if (!bestMatch || normalizedDirPath.length > bestMatch.path.length) {
				bestMatch = { path: normalizedDirPath, profile };
			}
		}
	}
	
	if (bestMatch) {
		const currentProfile = vscode.workspace.getConfiguration('workbench').get<string>('profile');
		if (currentProfile !== bestMatch.profile) {
			await vscode.workspace.getConfiguration('workbench').update(
				'profile',
				bestMatch.profile,
				vscode.ConfigurationTarget.Workspace
			);
		}
	}
}
