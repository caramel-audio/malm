// Project list and current project state.
// Project list stored in localStorage; audio/results stored in OPFS.

import { deleteProjectFiles } from '$lib/storage/opfs';
import { defaultCrossoverForNewProject } from './presets.svelte';

export type ProjectMeta = {
	id: string;
	name: string;
	createdAt: number;
	updatedAt: number;
	fileCount: number;
	fileSizeBytes: number;
};

const STORAGE_KEY = 'malm_projects';

function loadProjectList(): ProjectMeta[] {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) return JSON.parse(raw) as ProjectMeta[];
	} catch {}
	return [];
}

function persistProjectList(list: ProjectMeta[]): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
	} catch {}
}

export const projects = $state<{ list: ProjectMeta[]; current: ProjectMeta | null }>({
	list: loadProjectList(),
	current: null
});

export function refreshProjectList(): void {
	projects.list = loadProjectList();
}

export function createProject(name: string): ProjectMeta {
	// Carry over the crossovers you were last working with — starting from the
	// bare defaults every time is never what you want.
	const inherited = defaultCrossoverForNewProject(projects.list);

	const project: ProjectMeta = {
		id: crypto.randomUUID(),
		name: name.trim() || 'Untitled Project',
		createdAt: Date.now(),
		updatedAt: Date.now(),
		fileCount: 0,
		fileSizeBytes: 0
	};
	projects.list.push(project);
	persistProjectList(projects.list);

	if (inherited) {
		try {
			localStorage.setItem(`malm_project_${project.id}_options`, JSON.stringify(inherited));
		} catch {}
	}

	return project;
}

export function updateProjectMeta(
	id: string,
	patch: Partial<Pick<ProjectMeta, 'name' | 'fileCount' | 'fileSizeBytes' | 'updatedAt'>>
): void {
	const p = projects.list.find((p) => p.id === id);
	if (!p) return;
	Object.assign(p, patch);
	persistProjectList(projects.list);
}

export async function deleteProject(id: string): Promise<void> {
	const idx = projects.list.findIndex((p) => p.id === id);
	if (idx >= 0) projects.list.splice(idx, 1);
	persistProjectList(projects.list);

	// Clean up per-project localStorage keys
	localStorage.removeItem(`malm_project_${id}_options`);

	// Storage may be unavailable; the project is gone from the list either way.
	await deleteProjectFiles(id).catch(() => {});
}

export function renameProject(id: string, name: string): void {
	updateProjectMeta(id, { name: name.trim() || 'Untitled Project', updatedAt: Date.now() });
}
