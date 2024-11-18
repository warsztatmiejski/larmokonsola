// LARMO! konsola – simple beatmaker
// by Aleksander Lenart @ Warsztat Miejski 2024
// MIT license

const AudioModule = (() => {
	const audioFolder = 'audio/';
	const imageFolder = 'images/';
	const soundLibrary = [
		{ name: 'Masz.1', audio: 'maszyna.wav', image: 'maszyna.jpg' },
		{ name: 'Fabr.1', audio: 'fabryka.wav', image: 'fabryka.jpg' },
		{ name: 'Cyk', audio: 'hihat.wav', image: 'cyk.jpg' },
		{ name: 'Bang', audio: 'bang.wav', image: 'bang.jpg' }
	];
	const audioContext = new (window.AudioContext || window.webkitAudioContext)();
	let soundBuffers = [];

	async function loadSounds() {
		for (let sound of soundLibrary) {
			try {
				const response = await fetch(audioFolder + sound.audio);
				const arrayBuffer = await response.arrayBuffer();
				const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
				soundBuffers.push(audioBuffer);
			} catch (error) {
				console.error(`Failed to load sound: ${sound.audio}`, error);
			}
		}
	}
	return {
		audioContext,
		soundLibrary,
		soundBuffers,
		loadSounds,
		imageFolder
	};
})();

const BeatmakerModule = (() => {
	const { audioContext, soundLibrary, soundBuffers, loadSounds, imageFolder } = AudioModule;
	const numTracks = soundLibrary.length;
	const numBeats = 16;
	let beatGrid = Array.from({ length: numTracks }, () => Array(numBeats).fill(false));
	let currentBeat = 0;
	let isPlaying = false;
	let tempo = 100;
	let scheduledTime = 0;
	let lookahead = 25.0;
	let scheduleAheadTime = 0.1;
	let timerID;
	const playbackRates = Array(numTracks).fill(1.0);
	const volumes = Array(numTracks).fill(1.0);
	const beatmakerDiv = document.getElementById('beatmaker');
	const playPauseButton = document.getElementById('play-pause');
	const tempoSlider = document.getElementById('tempo-slider');
	const bpmValue = document.getElementById('bpm-value');
	const clearAllButton = document.getElementById('clear-all');
	const patternListDiv = document.getElementById('pattern-list');

	const predefinedPatterns = [
		{
			name: 'Hip-Hop Huta',
			tempo: 90,
			data: [
				{ track: 0, volume: 0.8, rate: 1.0, beats: '1000100010001000' },
				{ track: 2, volume: 1.0, rate: 1.0, beats: '0101010101010101' },
				{ track: 3, volume: 0.9, rate: 1.0, beats: '1010101010101010' }
			]
		},
		{
			name: 'Fa-Bryka',
			tempo: 120,
			data: [
				{ track: 0, volume: 1.0, rate: 1.0, beats: '1100110011001100' },
				{ track: 1, volume: 0.8, rate: 1.2, beats: '0011001100110011' },
				{ track: 3, volume: 1.0, rate: 1.0, beats: '0110011001100110' }
			]
		}
		// Add more patterns as needed
	];

	const gainNodes = Array(numTracks).fill(null).map(() => audioContext.createGain());
	const trackColors = Array(numTracks).fill(null).map(() => getRandomColor());
	const colors = [
		'ff0029', '377eb8', '66a61e', '984ea3',
		'00d2d5', 'ff7f00', 'af8d00', '7f80cd',
		'b3e900', 'c42e60', 'a65628', 'f781bf',
		'8dd3c7', 'bebada', 'fb8072', '80b1d3'
	];

	function init() {
		createTrackControls();
		loadSounds().then(() => {
			updateUI();
			setupEventListeners();
			updateSliderWidths();
			populatePatternList();
		});
	}

	function createTrackControls() {
		for (let i = 0; i < numTracks; i++) {
			const trackDiv = document.createElement('div');
			trackDiv.classList.add('track');
			const controlWrapper = document.createElement('div');
			controlWrapper.classList.add('control-wrapper');
			// const beatColor = trackColors[i];
			const beatColor = '#' + colors[i];
			controlWrapper.style.setProperty('--beat-color', beatColor);
			const controlBgDiv = document.createElement('div');
			controlBgDiv.classList.add('control-bg');
			controlBgDiv.style.backgroundImage = `url(${imageFolder}${soundLibrary[i].image})`;
			controlWrapper.appendChild(controlBgDiv);
			const trackName = document.createElement('div');
			trackName.classList.add('track-name');
			trackName.textContent = soundLibrary[i].name;
			controlWrapper.appendChild(trackName);
			const slidersContainer = document.createElement('div');
			slidersContainer.classList.add('sliders-container');
			const volumeWrapper = document.createElement('div');
			volumeWrapper.classList.add('slider-wrapper', 'volume-slider-wrapper');
			const volumeInput = document.createElement('input');
			volumeInput.type = 'range';
			volumeInput.classList.add('form-range', 'volume-slider');
			volumeInput.min = '0';
			volumeInput.max = '1';
			volumeInput.step = '0.01';
			volumeInput.value = '1.0';
			volumeInput.dataset.trackIndex = i;
			volumeInput.addEventListener('input', (e) => {
				const trackIdx = parseInt(e.target.dataset.trackIndex);
				volumes[trackIdx] = parseFloat(e.target.value);
				gainNodes[trackIdx].gain.value = volumes[trackIdx];
			});
			volumeWrapper.appendChild(volumeInput);
			const rateWrapper = document.createElement('div');
			rateWrapper.classList.add('slider-wrapper', 'rate-slider-wrapper');
			const playbackRateInput = document.createElement('input');
			playbackRateInput.type = 'range';
			playbackRateInput.classList.add('form-range', 'rate-slider');
			playbackRateInput.min = '0.5';
			playbackRateInput.max = '2.0';
			playbackRateInput.step = '0.01';
			playbackRateInput.value = '1.0';
			playbackRateInput.dataset.trackIndex = i;
			playbackRateInput.addEventListener('input', (e) => {
				const trackIdx = parseInt(e.target.dataset.trackIndex);
				playbackRates[trackIdx] = parseFloat(e.target.value);
			});
			rateWrapper.appendChild(playbackRateInput);
			slidersContainer.appendChild(volumeWrapper);
			slidersContainer.appendChild(rateWrapper);
			controlWrapper.appendChild(slidersContainer);
			trackDiv.appendChild(controlWrapper);
			const beatGridDiv = document.createElement('div');
			beatGridDiv.classList.add('beat-grid');
			for (let beat = 0; beat < numBeats; beat++) {
				const beatDiv = document.createElement('div');
				beatDiv.classList.add('beat');
				beatDiv.dataset.track = i;
				beatDiv.dataset.beat = beat;
				const beatImageDiv = document.createElement('div');
				beatImageDiv.classList.add('beat-image');
				beatImageDiv.style.backgroundImage = `url(${imageFolder}${soundLibrary[i].image})`;
				beatDiv.appendChild(beatImageDiv);
				beatDiv.style.setProperty('--beat-color', beatColor);
				beatDiv.addEventListener('click', () => {
					beatGrid[i][beat] = !beatGrid[i][beat];
					beatDiv.classList.toggle('active', beatGrid[i][beat]);
				});
				beatGridDiv.appendChild(beatDiv);
			}
			trackDiv.appendChild(beatGridDiv);
			beatmakerDiv.appendChild(trackDiv);
		}
	}

	function populatePatternList() {
		predefinedPatterns.forEach((pattern, index) => {
			const patternItem = document.createElement('a');
			patternItem.href = '#';
			patternItem.textContent = pattern.name;
			patternItem.addEventListener('click', (e) => {
				e.preventDefault();
				loadPattern(index);
			});
			patternListDiv.appendChild(patternItem);
		});
	}

	function loadPattern(index) {
		const pattern = predefinedPatterns[index];
		if (pattern) {
			clearAllTracks();
			tempo = pattern.tempo || 100;
			tempoSlider.value = tempo;
			bpmValue.textContent = `${tempo} BPM`;
			pattern.data.forEach(item => {
				const trackIdx = item.track;
				volumes[trackIdx] = item.volume;
				gainNodes[trackIdx].gain.value = item.volume;
				playbackRates[trackIdx] = item.rate;
				const volumeSlider = document.querySelector(`.volume-slider[data-track-index='${trackIdx}']`);
				if (volumeSlider) {
					volumeSlider.value = item.volume;
				}
				const rateSlider = document.querySelector(`.rate-slider[data-track-index='${trackIdx}']`);
				if (rateSlider) {
					rateSlider.value = item.rate;
				}
				const beats = item.beats.split('').map(char => char === '1');
				beatGrid[trackIdx] = beats;
			});
			updateBeatGridUI();
		}
	}

	function updateBeatGridUI() {
		for (let track = 0; track < numTracks; track++) {
			for (let beat = 0; beat < numBeats; beat++) {
				const beatDiv = document.querySelector(`.beat[data-track='${track}'][data-beat='${beat}']`);
				if (beatDiv) {
					beatDiv.classList.toggle('active', beatGrid[track][beat]);
				}
			}
		}
	}

	function clearAllTracks() {
		beatGrid = Array.from({ length: numTracks }, () => Array(numBeats).fill(false));
		updateBeatGridUI();
		volumes.fill(1.0);
		playbackRates.fill(1.0);
		document.querySelectorAll('.volume-slider').forEach(slider => slider.value = 1.0);
		document.querySelectorAll('.rate-slider').forEach(slider => slider.value = 1.0);
		gainNodes.forEach(node => node.gain.value = 1.0);
		tempo = 100;
		tempoSlider.value = tempo;
		bpmValue.textContent = `${tempo} BPM`;
		stopPlayback();
	}

	function setupEventListeners() {
		playPauseButton.addEventListener('click', togglePlayPause);
		clearAllButton.addEventListener('click', clearAllTracks);
		tempoSlider.addEventListener('input', (e) => {
			tempo = e.target.value;
			bpmValue.textContent = `${tempo} BPM`;
		});
		const beatDivs = document.querySelectorAll('.beat');
		beatDivs.forEach(beatDiv => {
			beatDiv.addEventListener('touchstart', (e) => {
				e.preventDefault();
				const track = parseInt(beatDiv.dataset.track);
				const beat = parseInt(beatDiv.dataset.beat);
				beatGrid[track][beat] = !beatGrid[track][beat];
				beatDiv.classList.toggle('active', beatGrid[track][beat]);
			});
		});
		window.addEventListener('resize', updateSliderWidths);
	}

	function updateSliderWidths() {
		const sliderWrappers = document.querySelectorAll('.slider-wrapper');
		sliderWrappers.forEach(wrapper => {
			const slider = wrapper.querySelector('input[type="range"]');
			const wrapperHeight = wrapper.clientHeight;
			slider.style.width = `${wrapperHeight}px`;
		});
	}

	function playSound(buffer, time, trackIndex) {
		if (buffer) {
			const source = audioContext.createBufferSource();
			source.buffer = buffer;
			source.playbackRate.value = playbackRates[trackIndex];
			source.connect(gainNodes[trackIndex]).connect(audioContext.destination);
			source.start(time);
		}
	}

	function scheduler() {
		while (scheduledTime < audioContext.currentTime + scheduleAheadTime) {
			scheduleBeat(currentBeat, scheduledTime);
			scheduledTime += (60 / tempo) / 4;
			currentBeat = (currentBeat + 1) % numBeats;
		}
	}

	function scheduleBeat(beatNumber, time) {
		for (let track = 0; track < numTracks; track++) {
			if (beatGrid[track][beatNumber]) {
				playSound(soundBuffers[track], time, track);
			}
		}
		highlightBeat(beatNumber);
	}

	function highlightBeat(beatNumber) {
		const highlightedBeats = document.querySelectorAll('.beat.highlight');
		highlightedBeats.forEach(beatDiv => {
			beatDiv.classList.remove('highlight');
		});
		for (let track = 0; track < numTracks; track++) {
			const beatDiv = document.querySelector(`.beat[data-track='${track}'][data-beat='${beatNumber}']`);
			if (beatDiv) {
				beatDiv.classList.add('highlight');
			}
		}
	}

	function getRandomColor() {
		const hue = Math.floor(Math.random() * 360);
		const saturation = Math.floor(Math.random() * (100 - 70 + 1)) + 70;
		const lightness = Math.floor(Math.random() * (40 - 20 + 1)) + 20;
		return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
	}

	function togglePlayPause() {
		const playPauseIcon = document.getElementById('play-pause-icon');
		if (isPlaying) {
			clearInterval(timerID);
			isPlaying = false;
			playPauseIcon.classList.remove('pause');
			playPauseIcon.classList.add('play');
			playPauseButton.classList.remove('active');
		} else {
			if (audioContext.state === 'suspended') {
				audioContext.resume();
			}
			scheduledTime = audioContext.currentTime;
			timerID = setInterval(scheduler, lookahead);
			isPlaying = true;
			playPauseIcon.classList.remove('play');
			playPauseIcon.classList.add('pause');
			playPauseButton.classList.add('active');
		}
	}

	function stopPlayback() {
		const playPauseIcon = document.getElementById('play-pause-icon');
		if (isPlaying) {
			clearInterval(timerID);
			isPlaying = false;
			playPauseIcon.classList.remove('pause');
			playPauseIcon.classList.add('play');
			playPauseButton.classList.remove('active');
		}
		currentBeat = 0;
		scheduledTime = audioContext.currentTime;
		const highlightedBeats = document.querySelectorAll('.beat.highlight');
		highlightedBeats.forEach(beatDiv => {
			beatDiv.classList.remove('highlight');
		});
	}

	function updateUI() {
		bpmValue.textContent = `${tempo} BPM`;
	}

	document.body.addEventListener('click', () => {
		if (audioContext.state === 'suspended') {
			audioContext.resume();
		}
	}, { once: true });

	return {
		init
	};
})();

BeatmakerModule.init();