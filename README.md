# Bazarr movie subtitle lookup for Tunarr

Check which subtitle languages Bazarr has indexed for a movie in Tunarr. The extension also shows which languages the movie’s Bazarr profile still wants. The extension reads Bazarr’s library through its movies API. Subtitle downloads and playback stay with Bazarr and Tunarr.

## Install

Run Bazarr and connect it to Radarr. Installing this adapter connects Tunarr to that existing library.

1. Open **Settings → Extensions**. Choose **Bazarr** from the default source and click **Install**. [Tunarr extension store](https://github.com/TacoRocket/tunarr-extensions)
2. In **Configure**, enter the **Bazarr URL** that the extension host can reach, including its port and URL base. For example, if the containers share a network and the service is named `bazarr`, use `http://bazarr:6767` or `http://bazarr:6767/subtitles` for a service mounted at `/subtitles`. Use an address reachable from your Tunarr installation or from the separate extension host in the original trial.
3. Choose **Test connection**. You can leave **API key** blank to try the connection. If Bazarr returns HTTP 401 or 403, copy its key from **Bazarr → Settings → General → Security**, enter it and test again. A LAN connection can still require a key. **Test connection** leaves the settings unsaved. **Cancel** discards your edits. **Save and enable** checks the connection again and stores the settings on success.
4. Open the movie in Tunarr’s library and copy the last part of its address after `/web/media/movie/`. Paste it into **Tunarr movie program ID** and choose **Check subtitles**. The adapter matches Tunarr’s IMDb ID to a movie in Bazarr and shows its installed and missing subtitle languages. If multiple editions share that ID, the result is ambiguous. A movie with no assigned Bazarr profile has no missing-language result.
5. Choose **Disable** to stop lookups. **Enable** uses the saved settings again.

If your Tunarr has no Extensions page, see the host setup instructions in the [Tunarr extension store](https://github.com/TacoRocket/tunarr-extensions#if-your-tunarr-has-no-extensions-page).

## Package and API

Version 1.0.0 targets the proposed Tunarr host API v2. The store lists this package separately from the Python trial. Availability in a Tunarr release depends on the host change landing. The API v1 trial continues to use [v0.5.0](https://github.com/TacoRocket/tunarr-bazarr-extension/tree/v0.5.0).

The manifest names the JavaScript entrypoint, its SHA-256 digest, settings, actions and permitted reads. The host calls `run(input)`. For a lookup it supplies the movie type and external identifiers in `input.program`. The adapter requires exactly one distinct valid IMDb identifier. It reads Bazarr’s movie index in pages of 200, up to 10,000 titles. The connection test reads a single row.

The adapter calls `readJson("movies", { start, length })`. The host resolves the configured Bazarr URL and supplies the optional `X-API-KEY` header. The adapter receives the JSON response. Its code never needs the key or a network client.

A match returns the movie title and the distinct installed and missing language codes. Missing languages are null when the movie has no assigned Bazarr profile. Unmatched and ambiguous IDs have separate statuses. These results describe Bazarr’s index of the movie. The player and Tunarr handle subtitle playback.

The API v2 host can find the pinned release in [feed-v2.json](feed-v2.json). [feed.json](feed.json) continues to point to the older Python release for API v1.
