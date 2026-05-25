# Monte Carlo Phase Resampling

Browser demo for random-phase one-shot resynthesis.

This demo explores the following research question:

> Percussive one-shot sounds exhibit nontrivial perceptual tolerance to STFT phase randomization, and this tolerance can be exploited as a sound-design search space rather than treated as reconstruction error.

Short version:

> Phase does not always have to be restored as a ground-truth object. For percussive one-shots, it can be resampled as a timbre-design degree of freedom.

## Demo

Open `index.html` in a browser, or publish this repository with GitHub Pages.

Expected GitHub Pages URL:

```text
https://nullheart.github.io/monte-carlo-phase-resampling/
```

## Signal Path

1. Load a percussive one-shot WAV or use the default synthetic sample.
2. Mix to mono.
3. Compute an STFT.
4. Keep the magnitude spectrogram fixed.
5. Blend the original phase with random phase using `Random Phase Mix`.
6. Run exactly one inverse STFT pass.
7. Snap boundaries to nearby zero crossings.
8. Play or export the resampled take.

This is intentionally not Griffin-Lim reconstruction. The goal is not to recover a consistent original phase, but to sample useful percussive variants from the phase degrees of freedom.

## Prior Art

See [PRIOR_ART.md](./PRIOR_ART.md) for a compact research-context note on phase perception, STFT phase reconstruction, phase-aware spectrogram models, sound texture synthesis, and the research gap targeted by this demo.

## Files

- `index.html`: GitHub Pages demo shell.
- `styles.css`: responsive UI styling.
- `app.js`: FFT, STFT, random phase resampling, single-pass ISTFT, playback, WAV export.
- `_headers`: optional security headers for Cloudflare Pages; ignored by GitHub Pages.
- `PRIOR_ART.md`: prior-art and positioning note.

## Related Product

This research demo is separated from the commercial-facing prototype `Tighten Your Kick`.

## Contact

represent.area955@gmail.com

## License

License is not specified yet.
