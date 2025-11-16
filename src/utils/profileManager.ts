import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

/**
 * Gets the profile ID to name mapping from VS Code/Cursor storage
 * Returns a map of profile ID -> profile name
 */
async function getProfileIdToNameMap(): Promise<Record<string, string>> {
	const profileIdToNameMap: Record<string, string> = {};

	try {
		const userDataPath = getVSCodeUserDataPath();
		if (!userDataPath) {
			return profileIdToNameMap;
		}

		const userPath = path.join(userDataPath, "User");
		const globalStoragePath = path.join(userPath, "globalStorage", "storage.json");

		if (fs.existsSync(globalStoragePath)) {
			try {
				const globalStorageContent = fs.readFileSync(globalStoragePath, "utf8");
				const globalStorage = JSON.parse(globalStorageContent);

				// The userDataProfiles array contains profile mappings
				if (globalStorage?.userDataProfiles && Array.isArray(globalStorage.userDataProfiles)) {
					for (const profile of globalStorage.userDataProfiles) {
						if (profile?.location && profile?.name) {
							profileIdToNameMap[profile.location] = profile.name;
						}
					}
					console.log("Loaded profile name mappings from globalStorage/storage.json:", profileIdToNameMap);
				}
			} catch (error) {
				console.warn("Error reading globalStorage/storage.json:", error);
			}
		}
	} catch (error) {
		console.warn("Error getting profile ID to name map:", error);
	}

	return profileIdToNameMap;
}

/**
 * Gets the profile ID for a given profile name
 * Returns the profile ID if found, or null if not found
 */
export async function getProfileIdFromName(profileName: string): Promise<string | null> {
	// Default profile doesn't have a profile ID in the same way
	// VS Code uses an empty string or special handling for default
	if (profileName === "Default") {
		// Try to find the default profile ID, or return empty string
		// The default profile might be identified differently
		return "";
	}

	try {
		const profileIdToNameMap = await getProfileIdToNameMap();
		
		// Reverse lookup: find ID by name
		for (const [profileId, name] of Object.entries(profileIdToNameMap)) {
			if (name === profileName) {
				return profileId;
			}
		}

		// If not found in map, check if the name itself is an ID (fallback)
		const userDataPath = getVSCodeUserDataPath();
		if (userDataPath) {
			const userPath = path.join(userDataPath, "User");
			const profilesPath = path.join(userPath, "profiles");
			
			if (fs.existsSync(profilesPath)) {
				const profileDir = path.join(profilesPath, profileName);
				if (fs.existsSync(profileDir) && fs.statSync(profileDir).isDirectory()) {
					// The name is actually an ID
					return profileName;
				}
			}
		}

		return null;
	} catch (error) {
		console.error("Error getting profile ID from name:", error);
		return null;
	}
}

/**
 * Switches to the specified profile by name
 * Returns true if successful, false otherwise
 * 
 * Note: VS Code's profile switching command may not accept parameters directly.
 * This function tries multiple approaches to switch profiles.
 */
export async function switchToProfile(profileName: string): Promise<boolean> {
	try {
		console.log(`Attempting to switch to profile: ${profileName}`);

		// Get the profile ID for the given name
		const profileId = await getProfileIdFromName(profileName);
		
		// Try multiple approaches to switch profiles
		const approaches = [];
		
		if (profileName === "Default") {
			// For Default profile, try different approaches
			approaches.push(
				() => vscode.commands.executeCommand("workbench.action.profiles.switchProfile", ""),
				() => vscode.commands.executeCommand("workbench.action.profiles.switchProfile", "Default"),
			);
		} else {
			// For named profiles, try with ID first, then name
			if (profileId !== null) {
				approaches.push(
					() => vscode.commands.executeCommand("workbench.action.profiles.switchProfile", profileId),
				);
			}
			approaches.push(
				() => vscode.commands.executeCommand("workbench.action.profiles.switchProfile", profileName),
			);
		}

		// Try each approach until one succeeds
		for (const approach of approaches) {
			try {
				await approach();
				// If we get here without error, the command executed
				// However, the command might just open a picker, so we can't be 100% sure it worked
				// We'll assume success if no error was thrown
				console.log(`Successfully executed profile switch command for: ${profileName}`);
				
				// Give VS Code a moment to process the command
				await new Promise(resolve => setTimeout(resolve, 500));
				
				return true;
			} catch (error) {
				// If the command doesn't exist or fails, try next approach
				const errorMessage = error instanceof Error ? error.message : String(error);
				console.log(`Profile switch approach failed: ${errorMessage}`);
				continue;
			}
		}

		// If all approaches failed, the command might not support parameters
		// In this case, we'll return false and the caller can handle it
		console.warn(`All profile switch approaches failed for: ${profileName}`);
		return false;
	} catch (error) {
		console.error(`Error switching to profile ${profileName}:`, error);
		return false;
	}
}

/**
 * Gets available VS Code/Cursor profiles from the file system
 * VS Code API doesn't provide a documented command to list all profiles,
 * so we read them directly from the profiles directory
 */
export async function getAvailableProfiles(): Promise<string[]> {
	const profiles: string[] = [];

	// Use file system method as it's the most reliable way to get all profiles
	// VS Code API doesn't provide a documented command to list all profiles
	try {
		const fsProfiles = await getAvailableProfilesFromFileSystem();
		if (fsProfiles.length > 0) {
			console.log("Available profiles from file system:", fsProfiles);
			return fsProfiles;
		}
	} catch (fsError) {
		console.error("Error reading profiles from file system:", fsError);
	}

	// Always include Default profile if not already present
	if (!profiles.includes("Default")) {
		profiles.unshift("Default");
	}

	// If no profiles found, at least return Default
	if (profiles.length === 0) {
		profiles.push("Default");
	}

	console.log("Available profiles:", profiles);

	return profiles.sort();
}

/**
 * Fallback method: Gets available VS Code profiles from the user's profile directory
 */
async function getAvailableProfilesFromFileSystem(): Promise<string[]> {
	const profiles: string[] = [];

	try {
		// VS Code/Cursor stores profiles in different locations based on OS
		const userDataPath = getVSCodeUserDataPath();
		if (!userDataPath) {
			console.warn("Could not find VS Code/Cursor user data path");
			// Return Default profile if we can't find the path
			profiles.push("Default");
			return profiles;
		}

		console.log("Found user data path:", userDataPath);
		const userPath = path.join(userDataPath, "User");
		const profilesPath = path.join(userPath, "profiles");
		console.log("Checking profiles path:", profilesPath);

		// Get profile name mappings using the helper function
		const profileIdToNameMap = await getProfileIdToNameMap();

		if (fs.existsSync(profilesPath)) {
			const entries = fs.readdirSync(profilesPath, { withFileTypes: true });
			console.log(`Found ${entries.length} entries in profiles directory`);

			for (const entry of entries) {
				if (entry.isDirectory()) {
					// Profile directories are named with profile IDs, not names
					// Skip hidden directories and system directories
					if (!entry.name.startsWith(".") && entry.name !== "cache") {
						const profileId = entry.name;
						
						// Get profile name from the map, default to ID if not found
						const profileName = profileIdToNameMap[profileId] || profileId;
						
						profiles.push(profileName);
						console.log(`Found profile: ${profileName} (ID: ${profileId})`);
					}
				}
			}
		} else {
			console.warn(`Profiles directory does not exist: ${profilesPath}`);
		}

		// Always include Default profile if not already present
		if (!profiles.includes("Default")) {
			profiles.unshift("Default");
			console.log("Added Default profile to list");
		}

		// If no profiles found, at least return Default
		if (profiles.length === 0) {
			profiles.push("Default");
			console.log("No profiles found, returning Default only");
		}
	} catch (error) {
		console.error("Error reading profiles from file system:", error);
		// Always return at least Default profile even on error
		if (profiles.length === 0) {
			profiles.push("Default");
		}
	}

	return profiles.sort();
}

/**
 * Gets the VS Code/Cursor user data path based on the OS
 * Checks multiple possible editor installations (VS Code, VS Code Insiders, Cursor, etc.)
 */
function getVSCodeUserDataPath(): string | null {
	const platform = process.platform;
	const possiblePaths: string[] = [];

	// Build list of possible paths based on OS
	switch (platform) {
		case 'darwin':
			possiblePaths.push(
				path.join(os.homedir(), 'Library', 'Application Support', 'Cursor'),
				path.join(os.homedir(), 'Library', 'Application Support', 'Code'),
				path.join(os.homedir(), 'Library', 'Application Support', 'Code - Insiders'),
				path.join(os.homedir(), 'Library', 'Application Support', 'VSCodium'),
			);
			break;
		case 'win32':
			possiblePaths.push(
				path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor'),
				path.join(os.homedir(), 'AppData', 'Roaming', 'Code'),
				path.join(os.homedir(), 'AppData', 'Roaming', 'Code - Insiders'),
				path.join(os.homedir(), 'AppData', 'Roaming', 'VSCodium'),
			);
			break;
		case 'linux':
			possiblePaths.push(
				path.join(os.homedir(), '.config', 'Cursor'),
				path.join(os.homedir(), '.config', 'Code'),
				path.join(os.homedir(), '.config', 'Code - Insiders'),
				path.join(os.homedir(), '.config', 'VSCodium'),
			);
			break;
		default:
			return null;
	}

	// Check each possible path and return the first one that exists
	for (const basePath of possiblePaths) {
		if (fs.existsSync(basePath)) {
			return basePath;
		}
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
		// Get workspace profile from VS Code configuration (reads from .vscode/settings.json)
		const config = vscode.workspace.getConfiguration("profileSwitcher", folder.uri);
		const workspaceProfile = config.get<string>("workspaceProfile");
		
		if (workspaceProfile) {
			// Actually switch to the configured profile
			const switched = await switchToProfile(workspaceProfile);
			if (switched) {
				console.log(`Successfully switched to workspace profile: ${workspaceProfile}`);
			} else {
				console.warn(`Failed to switch to workspace profile: ${workspaceProfile}`);
				// Show notification if switch failed
				vscode.window.showWarningMessage(
					`Failed to switch to profile "${workspaceProfile}". Please switch manually.`,
					'Switch Profile'
				).then(selection => {
					if (selection === 'Switch Profile') {
						vscode.commands.executeCommand('workbench.action.profiles.switchProfile');
					}
				});
			}
			return; // Workspace profile takes precedence
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
			const relativePath = `${path.relative(workspacePath, activeFilePath).replace(/\\/g, "/")}/`;

			for (const [dirPath, profile] of Object.entries(directoryProfiles)) {
				const normalizedDirPath = dirPath.endsWith("/") ? dirPath : `${dirPath}/`;
				
				if (relativePath.startsWith(normalizedDirPath)) {
					if (!bestMatch || normalizedDirPath.length > bestMatch.path.length) {
						bestMatch = { path: normalizedDirPath, profile };
					}
				}
			}
			
			if (bestMatch) {
				// Actually switch to the configured profile
				const switched = await switchToProfile(bestMatch.profile);
				if (switched) {
					console.log(`Successfully switched to directory profile: ${bestMatch.profile} for ${bestMatch.path}`);
				} else {
					console.warn(`Failed to switch to directory profile: ${bestMatch.profile}`);
					// Show notification if switch failed
					vscode.window.showWarningMessage(
						`Failed to switch to profile "${bestMatch.profile}" for directory "${bestMatch.path}". Please switch manually.`,
						'Switch Profile'
					).then(selection => {
						if (selection === 'Switch Profile') {
							vscode.commands.executeCommand('workbench.action.profiles.switchProfile');
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
		// Workspace profile applies to all files, so we don't need to switch again
		// (it should have been applied on startup)
		return;
	}

	// Check directory profiles
	const directoryProfiles = config.get<Record<string, string>>("directoryProfiles", {});
	const activeFilePath = activeEditor.document.uri.fsPath;
	const relativePath = `${path.relative(workspacePath, activeFilePath).replace(/\\/g, "/")}/`;

	let bestMatch: { path: string; profile: string } | undefined;

	for (const [dirPath, profile] of Object.entries(directoryProfiles)) {
		const normalizedDirPath = dirPath.endsWith("/") ? dirPath : `${dirPath}/`;
		
		if (relativePath.startsWith(normalizedDirPath)) {
			if (!bestMatch || normalizedDirPath.length > bestMatch.path.length) {
				bestMatch = { path: normalizedDirPath, profile };
			}
		}
	}
	
	if (bestMatch) {
		// Actually switch to the configured profile
		// We'll do this silently to avoid too many notifications when switching files
		const switched = await switchToProfile(bestMatch.profile);
		if (switched) {
			console.log(`Successfully switched to directory profile: ${bestMatch.profile} for ${bestMatch.path}`);
		} else {
			console.warn(`Failed to switch to directory profile: ${bestMatch.profile}`);
		}
	}
}
