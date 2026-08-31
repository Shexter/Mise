# Voice transcription platforms

The evidence behind the transcription architecture in `voice-pantry-intake`.
Written before any adapter was built, because the choice determines whether the
feature can keep its local-first promise at all.

Every row below is either verified against the named source or explicitly marked
as unverified. An unverified row is not a decision input until a spike closes it.

## What the repository starts with

Expo SDK 54 ships no speech-to-text module, and `expo-speech` is text *to*
speech. Before this change there was no microphone dependency, no `RECORD_AUDIO`,
and no `NSMicrophoneUsageDescription` anywhere in the project — so every option
below was an addition, and the cheapest option was the one that added nothing.

Options B and C have since been installed and wired; option A needs no
dependency and remains the floor. What each one costs is recorded below.

## The options

### A. Keyboard dictation, wrapped in our own UI

The OS keyboard's microphone key writing into a `TextInput` that Mise owns.

| | |
| --- | --- |
| iOS engine | Apple's own dictation — on-device on Apple-silicon-class devices |
| Android engine | Gboard voice typing, or Samsung's keyboard equivalent |
| New dependencies | none |
| Dev build required | no |
| Permission strings | none — the keyboard holds the microphone permission, not Mise |
| Offline | follows the OS keyboard's own offline model |
| Language | whatever the user's keyboard is set to |
| Programmatic start | **no** — the user must tap the keyboard's mic key |

This is the path the product owner asked for: "they can also use the mic button
on the keyboard thing but we can wrap it with our own ui." It is the only option
that works on the current build with no native change, and it is the only one
where Mise never touches audio at all — the keyboard delivers text, so there is
no raw audio for Mise to retain or delete.

Its one real cost is that Mise cannot start or stop listening. The session
chrome (elapsed time, Pause, Finish) describes a session the user drives from
the keyboard. The adapter reports this honestly via `canStartProgrammatically:
false` rather than faking a listening state it does not control.

### B. `expo-speech-recognition` (jamsch)

A community Expo module wrapping `SFSpeechRecognizer` on iOS and Android's
`SpeechRecognizer`.

| | |
| --- | --- |
| Install | `npm install expo-speech-recognition@sdk-54` — an SDK-54 tag exists |
| Licence | MIT |
| Dev build required | **yes** — native code, config plugin |
| iOS on-device | `requiresOnDeviceRecognition`, probe with `supportsOnDeviceRecognition()` |
| Android offline | per-locale models, downloaded via `androidTriggerOfflineModelDownload({ locale })` |
| Permissions | iOS `NSMicrophoneUsageDescription` + `NSSpeechRecognitionUsageDescription`; Android `RECORD_AUDIO` |
| Manifest | config plugin adds package visibility for `com.google.android.googlequicksearchbox` |
| Continuous mode | Android 13+ and iOS 18+. Android 12 and below cannot do continuous recognition |
| File input | yes — `audioSource: { uri }`, Android 13+ / iOS |

This is "Apple Intelligence or Samsung's native alternative" in code. It is the
best answer when it works, and it has three distinct ways not to work: the
module is absent (no dev build yet), the device has no on-device model for the
chosen locale, or the platform is too old for continuous recognition. Those are
three different recovery paths, which is why the adapter reports availability as
a reason rather than a boolean.

**Installed** (`expo-speech-recognition@sdk-54` → 3.1.3, MIT). The config plugin
is declared in `app.config.ts` with both usage descriptions, `RECORD_AUDIO`, and
`androidSpeechServicePackages: ['com.google.android.as']` — the on-device Android
System Intelligence service, without which `requiresOnDeviceRecognition` cannot
find a local model.

The adapter still probes at runtime rather than importing statically. The
package being a dependency does not mean its *native* side is present: Expo Go
has no custom native code, nor does a checkout that has not been prebuilt, nor
does the Node test runner. In all three the probe returns null and the ladder
falls to the keyboard instead of taking the screen down.

### C. On-device model sidecar — Parakeet TDT 0.6b v3

NVIDIA's 600M-parameter ASR model, downloaded on demand rather than bundled.

| | |
| --- | --- |
| Licence | CC-BY-4.0 |
| Parameters | 600M |
| Languages | **25 European languages**, with automatic language identification |
| Runtime on device | `sherpa-onnx` (React Native TurboModule exists), or a CoreML build on Apple hardware |
| Bundled | **no** — fetched at runtime, never in the APK or IPA |
| Measured size | **487 MB** (`…-v3-int8.tar.bz2`, read from the release asset) |

This is the requested fallback for when the OS path fails, and it is a good one
for European speech: it is genuinely offline, genuinely on-device, and its
licence permits shipping.

**It does not cover Mise's differentiator.** The v3 language list is Bulgarian,
Croatian, Czech, Danish, Dutch, English, Estonian, Finnish, French, German,
Greek, Hungarian, Italian, Latvian, Lithuanian, Maltese, Polish, Portuguese,
Romanian, Russian, Slovak, Slovenian, Spanish, Swedish, Ukrainian. No Chinese,
Japanese, Korean, Cantonese, Thai, Vietnamese, Malay, or Tagalog. A user naming
Asian pantry staples in their own language — the case `docs/identity-layer.md`
treats as the reason the alias layer stores script and never romanises — gets
nothing from Parakeet v3.

So the sidecar is a **registry**, not a single model. Parakeet v3 is its European
entry. SenseVoice (`sherpa-onnx-sense-voice-zh-en-ja-ko-yue`) is its CJK entry,
covering Chinese, English, Japanese, Korean, and Cantonese in one model. The
registry offers the model that matches the recognition language the user
selected, and offers nothing when no entry matches, which is honest rather than
silently transcribing Cantonese with a European model.

**Both are now wired.** `react-native-sherpa-onnx` (0.4.3, MIT) provides the
runtime, and its `download` entry point handles the part that would otherwise be
several hundred lines of worse: resumable downloads, `.tar.bz2` extraction,
checksum validation, disk-space checks, and recovering an interrupted transfer.
`ensureModelByCategory` is idempotent, which matters at 487 MB — a download
interrupted by a phone call resumes rather than starting again.

The measured archive sizes, read from the release assets rather than a README:

| Model | Archive | Size |
| --- | --- | --- |
| Parakeet TDT 0.6b v3 (int8) | `sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8.tar.bz2` | **487 MB** |
| SenseVoice Small (int8) | `sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2025-09-09.tar.bz2` | **166 MB** |

The fp16 Parakeet build is 1.1 GB and was not chosen. Neither is bundled: they
are fetched from NVIDIA's and FunAudioLLM's published releases only when the
user taps a button that already states the size, and both are deleted by
"Delete all data".

**No audio file is written on this path.** `createPcmLiveStream` delivers 16 kHz
mono float PCM straight from the microphone — exactly what `transcribeSamples`
wants — so the recording exists only as an in-memory buffer, capped at ten
minutes, and is dropped when the session ends. There is no `deleteAudio` to
forget to call, because there is nothing on disk to delete. That makes this the
strongest privacy position of the four adapters.

Its one honest cost: both models are *offline* recognisers rather than streaming
ones, so no text appears until Finish. The adapter reports
`providesLiveTranscript: false` and the surface says so, instead of showing an
empty box that reads as a dead microphone.

### D. Cloud transcription

Sending audio to a provider.

Rejected as a default and gated behind explicit per-session consent. The
reasoning is in the spec, not here: a vision key is not speech consent, and a
kitchen sweep records whatever else is audible in the kitchen. Kept as a
capability slot so the refusal is a decision the code expresses, not an omission.

## The tiering that follows

1. **Native OS recognition** (B) when its module is present and reports an
   on-device model for the selected language.
2. **A downloaded model** (C), once it is actually installed.
3. **Keyboard dictation** (A) — always available, and no audio touches Mise.
4. **Typing** — always present, never a downgrade, and the only path that needs
   no microphone at all.

Cloud (D) never enters this ladder automatically.

The downloaded model sits *above* the keyboard, which is not where this started.
The keyboard reports itself available unconditionally — it has to, since Mise
cannot see which languages someone's keyboard handles — so with it second, a
model the user had deliberately waited 487 MB for could never be selected. A
verified match on the language beats an unverifiable one. The keyboard remains
the floor, and remains the answer whenever nothing above it can serve the
language. `test/voice-session.test.ts` pins all three orderings.

## What was verified on the workstation

`npx expo-doctor` passes all 18 checks with both dependencies added, and
`npx expo config --type introspect` resolves the whole plugin chain with no
errors. Specifically confirmed:

- `RECORD_AUDIO`, `NSMicrophoneUsageDescription`, and
  `NSSpeechRecognitionUsageDescription` all reach the resolved config.
- The `<queries>` entry for `com.google.android.googlequicksearchbox` is applied
  by the plugin's manifest mod at prebuild — introspect does not render manifest
  mods, so its absence there proves nothing; the mod itself was read in
  `node_modules/expo-speech-recognition/app.plugin.js`. Without that entry
  Android 11+ cannot see the recogniser at all and every start fails with no
  useful error, so it is worth confirming in the built manifest.
- **No new Android permission surface.** `@dr.pogodin/react-native-fs` declares
  `WRITE_EXTERNAL_STORAGE`, which looked like a regression until it turned out
  `expo-image-picker` has been declaring both storage permissions since long
  before this change. The merged list is unchanged apart from `RECORD_AUDIO`.

What could *not* be verified here is anything requiring the native side: no
prebuild was run, no binary was measured, and no model was downloaded or
executed.

## Open items for the owner

Both dependencies are now installed, so every remaining item needs a device.

- **App size is unmeasured.** The models are external, but the *runtime* is not:
  `react-native-sherpa-onnx` links sherpa-onnx and ONNX Runtime into the binary,
  and that cost is paid by every user whether or not they ever download a model.
  Build the APK and compare against the previous release before shipping. If it
  is unacceptable, the honest fix is to drop option C entirely and keep the
  keyboard — the feature works without it.
- **`react-native-sherpa-onnx` is third-party, at 0.4.3, and unaudited here.**
  Early version numbers on a package that ships native code deserve a read of
  the diff before a release build.
- **The registry id mapping is unverified at runtime.** `modelStore.ts` resolves
  our models against the library's own registry by exact download URL, falling
  back to the archive stem. If upstream changes either, the download reports
  "not offered right now" rather than fetching something else — correct, but it
  means the mapping needs one real check on a device.
- **Neither model has been run on real speech here.** Recognition quality,
  first-run load time, and transcription latency on a mid-range Android are all
  unknown until someone speaks into it.

## What the local parser actually achieves

Measured by `test/voice-parser-corpus.test.ts` against the 34-utterance corpus
in `src/logic/__fixtures__/voiceUtterances.ts`, with no provider, no network,
and no model:

| Measure | Result |
| --- | --- |
| Candidate recall | 51 / 55 (92.7%) |
| Amount accuracy | 86 / 86 (100%) |
| False ingredients | **0** |
| Speech containing no food | 0 items produced, from 4 fixtures |

Per dimension, every category is at 100% except one:

| Dimension | Recall |
| --- | --- |
| baseline, filler, self-correction, containers, approximate, remaining, location, locale, script | full |
| noise | 3 / 7 |

**The whole shortfall is run-on speech with no punctuation.** "milk eggs bread
butter" and the tail of "three onion two pepper spinach" cannot be split from
the words alone: nothing distinguishes two adjacent foods from one two-word food
like "spring onion". Supplied with the catalogue's own names — which is how the
app calls the parser — both split correctly. The parser returns the phrase whole
rather than guessing, so the failure mode is a miss the user can edit, not an
invented ingredient.

That last property is the one the suite enforces hardest: false ingredients are
asserted at exactly zero, and amount accuracy at exactly 100%, so any future
loosening of the number rules fails the build rather than quietly reaching
review.
