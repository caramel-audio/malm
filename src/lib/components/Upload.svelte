<script lang="ts">
	// Top-left panel: drag-and-drop or file-picker upload
	// Displays list of uploaded files with name, artist, duration
	// Supports reordering and removal

	import { files } from '$lib/state/files.svelte';

	// TODO: handle dragover / drop events → decode audio → addFile()
	// TODO: handle <input type="file"> change → same pipeline
	// TODO: render file list with drag handles for reordering
</script>

<section>
	<!-- Drop zone -->
	<div class="drop-zone">
		<!-- TODO: drag-and-drop UI -->
		<p>Drop audio files here or <button>browse</button></p>
		<input type="file" accept="audio/*" multiple hidden />
	</div>

	<!-- File list -->
	<ul>
		{#each files.list as f (f.id)}
			<li>
				<!-- TODO: drag handle, name, artist, duration, remove button -->
				{f.name}
			</li>
		{/each}
	</ul>
</section>
