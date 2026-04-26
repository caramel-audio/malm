# Overview

A one-pager where
- the user can upload a number of audio files per drag-and-drop or file selection
- the splits the audio files into energy bands and calculates EBU R128 loudness for each band (as well as for the full spectrum)
- the results are plotted in graphs for easy comparison between the files
- the user can listen to the audio files and their energy bands

# UI

The app consists of three parts, splitted into top-left, top-right and bottom sections.

## Top-left: Upload
- The user can upload audio files by drag-and-drop or file selection
- The app accepts common audio formats (e.g., MP3, WAV, FLAC)
- The uploaded files are listed with their names, artist names and durations
- Files can be reordered and removed from the list

## Top-right: Options
- The user can define a list of frequencies, which will determine the energy bands for the loudness measurement
  - Default freqs: 80, 200, 800, 2000, 8000 Hz
- A primary process button starts the loudness analysis
  - On pressing the button, a progress bar is shown, which indicates the progress of the analysis
  - The button is disabled while the analysis is running
- A secondary button allows the user to reset the app, which clears all uploaded files and results

## Bottom: Results
- At the top, a dropdown allows the user to select which energy band to display in the graph (full spectrum is also an option)
- A second dropdown allows switching between momentary and short-term loudness
- For each file as given in the list, a plot is generated which takes up full width of the screen
- In the plot you can see the waveform, and on top of that the loudness curve for the selected energy band
- The user can click on the plot to listen to the audio at that point in time
  - If an energy band is selected, only that band is played back
  - The user can only listen to one audio file at a time, so clicking on a plot will stop any currently playing audio in other plots
- On hovering over the plot, beneath the plot all values at that time are displayed:
  - time in mm:ss
  - peak level in dBFS
  - momentary loudness in LUFS
  - short-term loudness in LUFS

# Analysis
- The app splits the audio files into energy bands based on the user-defined frequencies
- Energy bands are calculated using 24dB/Oct order Butterworth filters
- For each band, an audio buffer is created, which is used for both playback and loudness measurement
- For each energy band and the full spectrum, the app calculates EBU R128 loudness
- A plot point is generated every 100ms for the momentary loudness and every 400ms for the short-term loudness

# Tech stack
Everything happens in the browser, so no backend is needed.
For now, nothing is persisted, the page fully resets on refresh. In the future, we might want to add a backend for user accounts and saving projects.

- SvelteKit for the frontend
- Svelte $state runes as stores
- Web Audio API for audio processing
- Tailwind CSS for styling
- D3.js for plotting the graphs
- WaveSurfer.js for audio playback and visualization
- @domchristie/needles for loudness measurement_