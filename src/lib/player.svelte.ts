/**
 * Playback clock. Uses an <audio> element when audio is available, otherwise a
 * virtual timeline driven by performance.now().
 */
export class Player {
	time = $state(0);
	playing = $state(false);
	audioDuration = $state(0);
	virtualDuration = $state(60);
	/** When true and no audio is present, the virtual timeline grows while playing. */
	extendable = false;
	onended: (() => void) | null = null;

	audio: HTMLAudioElement | null = null;
	#raf = 0;
	#startedAt = 0;

	get duration() {
		return this.audio ? this.audioDuration : this.virtualDuration;
	}

	attach(el: HTMLAudioElement | null) {
		this.pause();
		this.audio = el;
		if (el) {
			el.onloadedmetadata = () => (this.audioDuration = el.duration || 0);
			el.onended = () => this.#ended();
			if (el.readyState >= 1) this.audioDuration = el.duration || 0;
		}
	}

	async play() {
		if (this.playing) return;
		if (this.audio) {
			if (this.time >= this.duration - 0.05) this.seek(0);
			try {
				await this.audio.play();
			} catch (e) {
				console.error(e);
				return;
			}
		} else {
			if (!this.extendable && this.time >= this.duration) this.time = 0;
			this.#startedAt = performance.now() - this.time * 1000;
		}
		this.playing = true;
		this.#tick();
	}

	pause() {
		this.playing = false;
		if (this.#raf) cancelAnimationFrame(this.#raf);
		this.audio?.pause();
	}

	toggle() {
		if (this.playing) this.pause();
		else this.play();
	}

	seek(t: number) {
		t = Math.max(0, this.extendable && !this.audio ? t : Math.min(t, this.duration));
		this.time = t;
		if (this.audio) this.audio.currentTime = t;
		else this.#startedAt = performance.now() - t * 1000;
	}

	#ended() {
		this.pause();
		this.onended?.();
	}

	#tick = () => {
		if (!this.playing) return;
		if (this.audio) {
			this.time = this.audio.currentTime;
		} else {
			this.time = (performance.now() - this.#startedAt) / 1000;
			if (this.extendable) {
				if (this.time > this.virtualDuration) this.virtualDuration = this.time;
			} else if (this.time >= this.virtualDuration) {
				this.time = this.virtualDuration;
				this.#ended();
				return;
			}
		}
		this.#raf = requestAnimationFrame(this.#tick);
	};

	destroy() {
		this.pause();
		if (this.audio) {
			this.audio.onloadedmetadata = null;
			this.audio.onended = null;
		}
	}
}

export function formatTime(t: number): string {
	if (!isFinite(t)) t = 0;
	const m = Math.floor(t / 60);
	const s = Math.floor(t % 60);
	return `${m}:${s.toString().padStart(2, '0')}`;
}
