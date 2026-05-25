# Prior Art and Research Context

This document summarizes prior work around STFT phase, phase reconstruction, phase-aware audio processing, and sound synthesis. It is not a full literature review. Its purpose is to position the research question behind this demo:

> Percussive one-shot sounds exhibit nontrivial perceptual tolerance to STFT phase randomization, and this tolerance can be exploited as a sound-design search space rather than treated as reconstruction error.

## 1. Phase Is Not Disposable

The classic signal-processing warning is that phase can carry perceptually and structurally important information.

- Oppenheim and Lim's classic paper, [The Importance of Phase in Signals](https://dsp-group.mit.edu/wp-content/uploads/2024/11/ImportancePhaseSignals_1981.pdf), showed that phase cannot be treated as a harmless leftover of Fourier analysis.
- In psychoacoustics, Pressnitzer and McAdams studied phase manipulations in [Two phase effects in roughness perception](https://pubmed.ncbi.nlm.nih.gov/10335629/), showing that phase can affect perceived roughness.
- Bass perception is also phase-sensitive in some settings; see [Effect of phase on the perceived level of bass](https://research.aalto.fi/en/publications/effect-of-phase-on-the-perceived-level-of-bass/).
- Speech enhancement research also revisits the older assumption that short-time phase is unimportant; see Paliwal, Wojcicki, and Shannon, [The importance of phase in speech enhancement](https://cir.nii.ac.jp/crid/1360011145436589184).

Implication for this project: the claim is not "phase does not matter." The safer claim is that for some percussive one-shots, randomized phase can remain perceptually usable and can become a controlled search dimension.

## 2. Magnitude-Only Reconstruction and Griffin-Lim

The closest classical family is magnitude-only STFT reconstruction.

- Griffin and Lim, [Signal estimation from modified short-time Fourier transform](https://cir.nii.ac.jp/crid/1363107370612773376?lang=en), introduced an iterative algorithm for estimating a signal from a modified STFT representation. The paper is the reference point for reconstructing audio from an STFT magnitude with missing or inconsistent phase.
- Le Roux, Kameoka, Ono, and Sagayama studied [Spectrogram consistency and its application to phase reconstruction](https://www.kecl.ntt.co.jp/people/kameoka.hirokazu/publications/LeRoux2009MUS07.pdf), formalizing when an STFT-like representation corresponds to a valid time-domain signal.
- Related work also explores faster or non-iterative phase reconstruction, including Prusa and Holighaus, [Phase Vocoder Done Right](https://zenodo.org/record/1159430), and Prusa, Balazs, and Sondergaard, [A Non-iterative Method for (Re)Construction of Phase from STFT Magnitude](https://arxiv.org/abs/1609.00291).

Difference from this demo: these methods generally treat missing phase as an error to be recovered. This demo intentionally does not run Griffin-Lim-style iterative reconstruction. It performs a single inverse STFT from a randomized phase field and evaluates whether the resulting one-shot is useful as a new sound.

## 3. Phase-Aware Spectrogram Models

Several audio-processing lines directly model phase or complex-valued spectrograms.

- Masuyama, Yatabe, and Oikawa proposed [Low-rankness of Complex-valued Spectrogram and Its Application to Phase-aware Audio Processing](https://cir.nii.ac.jp/crid/1362262946035974016), showing that phase conversion can reveal useful low-rank structure in complex spectrograms of harmonic signals.
- Yatabe, Masuyama, Kusano, and Oikawa discuss this direction in [Representation of complex spectrogram via phase conversion](https://www.jstage.jst.go.jp/article/jasj/75/3/75_147/_article/-char/en).
- Yatabe's review, [Phase Retrieval in Acoustical Signal Processing](https://cir.nii.ac.jp/crid/1390288547260771584), is a useful map of phase retrieval problems specific to acoustical signal processing.
- Phase-aware harmonic/percussive source separation also uses different assumptions for harmonic and percussive components; see [Phase-aware Harmonic/Percussive Source Separation via Convex Optimization](https://arxiv.org/abs/1903.05600).

Difference from this demo: this literature generally seeks better reconstruction, denoising, or source separation. The present demo focuses on creative resampling of percussive phase degrees of freedom, not faithful recovery.

## 4. Sound Texture and Statistical Synthesis

There is a related but distinct tradition in sound texture synthesis.

- McDermott and Simoncelli's [Sound texture perception via statistics of the auditory periphery](https://www.cns.nyu.edu/~lcv/pubs/makeAbs.php?loc=Mcdermott10) shows that many sound textures can be synthesized by matching auditory statistics.
- Later work continues to use phase-randomized or statistically resynthesized sounds to probe texture perception; for example, [A two-stage spectral model for sound texture perception](https://journals.sagepub.com/doi/10.1177/20416695231157349) compares natural and synthetic textures, including phase-randomized variants.

Difference from this demo: sound texture work often concerns stationary or multi-second textures such as rain, insects, machines, and environmental backgrounds. This demo targets short percussive one-shots, where attack, punch, and usability in music production are central.

## 5. Percussive Sound Modeling and Transient Control

Percussive sounds are often treated as a special case because transient structure strongly affects perception.

- Recent differentiable synthesis work explicitly models percussive transients and spectra; see [Differentiable Modelling of Percussive Audio with Transient and Spectral Synthesis](https://arxiv.org/abs/2309.06649).
- In music production, kick and drum processing often focuses on attack, body, peak shape, saturation, and phase alignment. The research gap is not whether percussive transients matter, but whether randomized STFT phase can be used to generate perceptually useful transient variants.

Difference from this demo: rather than designing a full physical or neural percussion model, this project starts from a single recorded one-shot and explores a local Monte Carlo neighborhood of phase-resampled variants.

## 6. Research Gap

The prior work suggests three constraints:

1. Phase can matter perceptually, so the project should not claim phase irrelevance.
2. STFT magnitude-only reconstruction is well studied, so random phase plus inverse STFT is not by itself novel.
3. Phase-aware processing usually treats phase as something to recover, regularize, or make consistent.

The open niche is:

> For percussive one-shot sound design, phase randomization may be useful even when it is not faithful. The output can be evaluated by perceptual usefulness, punch, hardness, and production value rather than reconstruction accuracy.

## 7. Testable Questions

This demo can support small listening and feature-analysis studies:

- How much STFT phase randomization can percussive one-shots tolerate before they stop being usable?
- Does tolerance differ across kick, snare, clap, tom, hi-hat, and synthetic percussion?
- How do FFT size and hop size affect perceived punch, roughness, hardness, and naturalness?
- Do objective features such as attack time, spectral centroid, crest factor, temporal centroid, high-frequency energy, and STFT consistency predict perceived usefulness?
- Does one-pass random phase resampling produce useful variants that Griffin-Lim-style reconstruction would suppress?

## 8. Positioning Statement

Monte Carlo phase resampling is best positioned as a sound-design and perception question, not as a reconstruction algorithm:

> Keep the magnitude spectrogram as the invariant. Randomize phase as the search dimension. Evaluate the output by percussive usability rather than signal fidelity.
