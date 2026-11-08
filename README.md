# Bazarr movie subtitle lookup

This proof-of-concept Tunarr extension reports subtitle languages Bazarr has indexed for a movie. It reads the paginated Bazarr movie listing and matches an exact IMDb ID across the listing. If different Radarr movie records share the ID, it reports an ambiguous match.

The extension host runs `python3 -I adapter.py`. It supplies a JSON object on standard input with `bazarrUrl`, `apiKey` and `imdbId`. On success, the process returns one JSON line. A matched result contains `title` and `installedLanguages` (distinct language codes). Version 0.2.0 also returns `missingLanguages` for the assigned Bazarr language profile. A null value means the movie has no profile. Unmatched and ambiguous results carry their respective status. A failed lookup exits nonzero with a short message on standard error.

The adapter sends authenticated GET requests to the configured Bazarr URL, including its URL base when applicable. Use a trusted service URL. Set a process deadline in the host. The adapter limits each network read and refuses libraries larger than 10,000 movies. Subtitle languages describe Bazarr's indexed files and tracks. The adapter does not download subtitles, change a language profile, or open a database.

The root manifest names the entrypoint, its digest, and its host API version. Pin the release commit when installing. The digest detects an artifact mismatch; trust in the package comes from the pinned source.
