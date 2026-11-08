# Bazarr movie subtitle lookup for Tunarr

Check which subtitle languages Bazarr has indexed for a movie in Tunarr. Version 0.4.0 also shows which languages the movie’s Bazarr profile still wants. The extension reads Bazarr’s library over HTTP. It does not download subtitles or change playback.

## Install in the trial

Run Bazarr and connect it to Radarr. Installing this adapter connects Tunarr to that existing library. For a separate Tunarr instance with the Extensions page, follow the [trial host setup](https://github.com/TacoRocket/tunarr/tree/trial/extension-store/docker/test/extensions).

1. Open **Settings → Extensions**. Choose **Bazarr** from the default source and click **Install**. The source currently offers version 0.4.0. [Tunarr extension store](https://github.com/TacoRocket/tunarr-extensions)
2. In **Configure**, enter the **Bazarr URL** that the extension host can reach, including its port and URL base. For example, if the containers share a network and the service is named `bazarr`, use `http://bazarr:6767` or `http://bazarr:6767/subtitles` for a service mounted at `/subtitles`. Inside the extension container, `localhost` points back to that container.
3. Choose **Test connection**. You can leave **API key** blank to try the connection. If Bazarr returns HTTP 401 or 403, copy its key from **Bazarr → Settings → General → Security**, enter it and test again. A LAN connection can still require a key. **Test connection** leaves the settings unsaved. **Cancel** discards your edits. **Save and enable** checks the connection again and stores the settings on success.
4. Open the movie in Tunarr’s library and copy the last part of its address after `/web/media/movie/`. Paste it into **Tunarr movie program ID** and choose **Check subtitles**. The adapter matches Tunarr’s IMDb ID to a movie in Bazarr and shows its installed and missing subtitle languages. If multiple editions share that ID, the result is ambiguous. A movie with no assigned Bazarr profile has no missing-language result.
5. Choose **Disable** to stop lookups. **Enable** uses the saved settings again.

## Package and API

The default source names the adapter repository, version and full release commit. You can also find the repository’s published release in [feed.json](feed.json). At the pinned commit, `tunarr-extension.json` names the entrypoint, its SHA-256 digest, host API version and settings fields.

The host runs `python3 -I adapter.py` with a JSON object on standard input. The object contains `bazarrUrl`, an optional `apiKey` and either `action: "test"` or a lookup `imdbId`. A test reads one row from the Bazarr movies endpoint. A lookup pages through up to 10,000 movies. The adapter sends the key only to the configured service and refuses redirects.

On success, the adapter returns one JSON line. A matched lookup contains `status`, `title` and `installedLanguages` (distinct language codes). Version 0.4.0 adds `missingLanguages` and uses null for a movie with no profile. The adapter reports unmatched or ambiguous IDs explicitly and exits nonzero for service errors. It reads no database and requires only the Python standard library. Its output describes Bazarr’s indexed metadata; playback and subtitle selection remain with Tunarr and the player.
