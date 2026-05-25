# Monte Carlo Phase Resampling

Browser demo for random-phase one-shot resynthesis.

This demo explores a simple claim:

> For percussive one-shot sounds, phase does not always have to be restored as a ground-truth object. It can be resampled as a timbre-design degree of freedom.

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

## Files

- `index.html`: GitHub Pages demo shell.
- `styles.css`: responsive UI styling.
- `app.js`: FFT, STFT, random phase resampling, single-pass ISTFT, playback, WAV export.
- `_headers`: optional security headers for Cloudflare Pages; ignored by GitHub Pages.

## Related Product

This research demo is separated from the commercial-facing prototype `Tighten Your Kick`.

## License

License is not specified yet.
