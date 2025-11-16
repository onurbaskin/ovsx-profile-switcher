import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

const WORKSPACE_PROFILE_KEY = 'profileSwitcher.workspaceProfile';
const DIRECTORY_PROFILES_KEY = 'profileSwitcher.directoryProfiles';

/**
 * Updates workspace settings.json with the specified workspace profile
 */
export async function updateWorkspaceProfile(workspacePath: string, profileName: string): Promise<void> {
	const settingsPath = path.join(workspacePath, '.vscode', 'settings.json');
	const settingsDir = path.dirname(settingsPath);

	// Ensure .vscode directory exists
	if (!fs.existsSync(settingsDir)) {
		fs.mkdirSync(settingsDir, { recursive: true });
	}

	// Read existing settings or create new object
	let settings: any = {};
	if (fs.existsSync(settingsPath)) {
		try {
			const content = fs.readFileSync(settingsPath, 'utf8');
			settings = JSON.parse(content);
		} catch (error) {
			console.error('Error reading settings.json:', error);
			settings = {};
		}
	}

	// Update the workspace profile setting
	settings[WORKSPACE_PROFILE_KEY] = profileName;

	// Write back to file
	fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
}

/**
 * Updates directory profiles in workspace settings.json
 * Adds or updates a directory profile mapping
 */
export async function updateDirectoryProfile(
	workspacePath: string,
	relativePath: string,
	profileName: string
): Promise<void> {
	const settingsPath = path.join(workspacePath, '.vscode', 'settings.json');
	const settingsDir = path.dirname(settingsPath);

	// Ensure .vscode directory exists
	if (!fs.existsSync(settingsDir)) {
		fs.mkdirSync(settingsDir, { recursive: true });
	}

	// Read existing settings or create new object
	let settings: any = {};
	if (fs.existsSync(settingsPath)) {
		try {
			const content = fs.readFileSync(settingsPath, 'utf8');
			settings = JSON.parse(content);
		} catch (error) {
			console.error('Error reading settings.json:', error);
			settings = {};
		}
	}

	// Ensure directoryProfiles object exists
	if (!settings[DIRECTORY_PROFILES_KEY]) {
		settings[DIRECTORY_PROFILES_KEY] = {};
	}

	// Normalize the path (ensure it ends with / for directories)
	const normalizedPath = relativePath.endsWith('/') ? relativePath : relativePath + '/';

	// Update the directory profile mapping
	settings[DIRECTORY_PROFILES_KEY][normalizedPath] = profileName;

	// Write back to file
	fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
}

/**
 * Gets the workspace profile from settings.json
 */
export function getWorkspaceProfile(workspacePath: string): string | undefined {
	const settingsPath = path.join(workspacePath, '.vscode', 'settings.json');
	
	if (!fs.existsSync(settingsPath)) {
		return undefined;
	}

	try {
		const content = fs.readFileSync(settingsPath, 'utf8');
		const settings = JSON.parse(content);
		return settings[WORKSPACE_PROFILE_KEY];
	} catch (error) {
		console.error('Error reading workspace profile from settings.json:', error);
		return undefined;
	}
}

/**
 * Gets the directory profiles from settings.json
 */
export function getDirectoryProfiles(workspacePath: string): Record<string, string> {
	const settingsPath = path.join(workspacePath, '.vscode', 'settings.json');
	
	if (!fs.existsSync(settingsPath)) {
		return {};
	}

	try {
		const content = fs.readFileSync(settingsPath, 'utf8');
		const settings = JSON.parse(content);
		return settings[DIRECTORY_PROFILES_KEY] || {};
	} catch (error) {
		console.error('Error reading directory profiles from settings.json:', error);
		return {};
	}
}

/**
 * Gets the profile for a specific file path by checking directory profiles
 * Returns the most specific matching profile
 */
export function getProfileForPath(workspacePath: string, filePath: string): string | undefined {
	// First check workspace profile
	const workspaceProfile = getWorkspaceProfile(workspacePath);
	if (workspaceProfile) {
		// For now, return workspace profile if it exists
		// Directory profiles will be checked in profileManager
	}

	// Get directory profiles
	const directoryProfiles = getDirectoryProfiles(workspacePath);
	
	// Calculate relative path from workspace root
	const relativePath = path.relative(workspacePath, filePath);
	
	// Find the most specific matching directory profile
	let bestMatch: { path: string; profile: string } | undefined;
	
	for (const [dirPath, profile] of Object.entries(directoryProfiles)) {
		// Normalize paths for comparison
		const normalizedDirPath = dirPath.endsWith('/') ? dirPath : dirPath + '/';
		const normalizedRelativePath = relativePath.replace(/\\/g, '/') + '/';
		
		// Check if the file path starts with this directory path
		if (normalizedRelativePath.startsWith(normalizedDirPath)) {
			// Use the longest matching path (most specific)
			if (!bestMatch || normalizedDirPath.length > bestMatch.path.length) {
				bestMatch = { path: normalizedDirPath, profile };
			}
		}
	}
	
	return bestMatch?.profile;
}

/**
 * Calculates the relative path from workspace root to the given folder path
 */
export function getRelativePathFromWorkspace(workspacePath: string, folderPath: string): string {
	const relative = path.relative(workspacePath, folderPath);
	// Normalize to use forward slashes and ensure it ends with /
	return relative.replace(/\\/g, '/') + (relative.endsWith('/') ? '' : '/');
}
