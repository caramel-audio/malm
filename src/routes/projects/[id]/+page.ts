import { redirect } from '@sveltejs/kit';
import { browser } from '$app/environment';
import { loadResults } from '$lib/storage/opfs';

export async function load({ params }: { params: { id: string } }) {
	if (browser) {
		const results = await loadResults(params.id);
		if (results) {
			throw redirect(307, `/projects/${params.id}/analysis`);
		}
	}
	throw redirect(307, `/projects/${params.id}/setup`);
}
