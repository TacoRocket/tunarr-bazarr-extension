# Bazarr movie subtitle lookup for Tunarr

Check which subtitle languages Bazarr has indexed for a movie in Tunarr. Version 0.4.0 also shows which languages the movie’s Bazarr profile still wants. The extension reads Bazarr’s library over HTTP. It does not download subtitles or change playback.

## Install in the trial

You need the Tunarr Extensions proof of concept and a running Bazarr instance connected to Radarr. If your Tunarr installation has no **Extensions** page, start with the [trial host setup](https://github.com/TacoRocket/tunarr/tree/trial/bazarr-extension-install/docker/test/extensions).

1. Open **Extensions** and paste this address into **GitHub repository URL**.

   ```text
   https://github.com/TacoRocket/tunarr-bazarr-extension
   ```

2. Choose **Find extension**, review the Bazarr entry, and click **Install**. The trial starts with version 0.3.0.
3. In **Configure**, enter the **Bazarr URL** that the extension host can reach. For example, if both containers share a network and the Bazarr service is named `bazarr`, use `http://bazarr:6767`. If Bazarr has a URL base, include it, for example `http://bazarr:6767/subtitles`. A container’s `localhost` refers to that same container.
4. Click **Test connection**. You can leave **API key** blank on first setup to test without a key. If Bazarr returns HTTP 401 or 403, copy its key from **Bazarr → Settings → General → Security**, enter it and test again. This can be required even on your own LAN. After a successful test, select **Save and enable**.
5. Enter a **Tunarr movie program ID** and choose **Check subtitles**. The host reads the movie’s IMDb ID from Tunarr. Bazarr must have exactly one matching Radarr movie. If multiple editions share that ID, the lookup reports an ambiguous match.
6. Check for an update in **Extensions**, install **0.4.0**, and repeat the same lookup. Alongside the installed languages, you will now see missing languages from the movie’s Bazarr profile. An unassigned profile gives no missing-language result.
7. Click **Disable** to stop the extension. Your saved settings are available when you **Enable** it again.

## Package and API

`feed.json` on the repository’s default branch advertises the current version and full release commit. The host fetches `tunarr-extension.json` at that commit. The manifest names the entrypoint, its SHA-256 digest, host API version and settings fields. Publishing a feed update is separate from installing it on a user’s instance.

The host runs `python3 -I adapter.py` with a JSON object on standard input. The object contains `bazarrUrl`, an optional `apiKey` and either `action: "test"` or a lookup `imdbId`. A test reads one row from the Bazarr movies endpoint. A lookup pages through up to 10,000 movies. The adapter sends the key only to the configured service and refuses redirects.

On success, the adapter returns one JSON line. A matched lookup contains `status`, `title` and `installedLanguages` (distinct language codes). Version 0.4.0 adds `missingLanguages` and uses null for a movie with no profile. The adapter reports unmatched or ambiguous IDs explicitly and exits nonzero for service errors. It reads no database and requires only the Python standard library. Its output describes Bazarr’s indexed metadata; playback and subtitle selection remain with Tunarr and the player.
