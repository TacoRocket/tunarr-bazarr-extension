# Bazarr

The Bazarr extension checks which subtitle languages Bazarr has for a movie in your Tunarr library, and asks Bazarr to search for the ones its language profile still needs. Bazarr saves what it finds next to the movie, where your media server picks it up.

In Tunarr's subtitle ladder, Bazarr comes third: the media server's subtitles first, then PGS, then Bazarr. A movie with no subtitles in Bazarr yet is the normal starting point.

## Prerequisites

- Tunarr with **Settings → Extensions** (extension API 0.5, an early beta).
- Bazarr, connected to Radarr.
- Bazarr's API key, from Bazarr → Settings → General → Security.
- An address Tunarr can reach: the same machine, a shared Docker network, or your LAN.

## Configuration

In Tunarr, open **Settings → Extensions**, choose **Add extension**, then **Install** on Bazarr.

| Setting | Description |
|---|---|
| Bazarr URL | The address Tunarr uses to reach Bazarr, including the port and any URL base. For example, `http://bazarr:6767`, or `http://bazarr:6767/subtitles` if Bazarr is mounted at `/subtitles`. |
| API key | Bazarr's API key. |

Select **Test** to check the settings, then **Save**.

## Actions

### Check subtitles

Choose a movie. The result says whether Bazarr has it, which subtitle languages it found and which ones its profile still needs.

### Search for missing subtitles

Choose a movie. Bazarr searches its subtitle providers for the languages its profile still needs, and the extension checks back for about 20 seconds. If Bazarr is still searching, check again in a minute.

## Data updates

The extension contacts Bazarr only when you run an action. A search checks back with Bazarr up to 4 times, 5 seconds apart, reading only that movie.

## Known limitations

- Movies only.
- Matching uses the movie's IMDb ID. A movie without exactly one IMDb ID can't be checked.
- Libraries larger than 9,000 movies can't be searched.
- Tunarr doesn't ask Bazarr on its own during playback yet; run the action from Settings.

## Troubleshooting

- **Bazarr refused the API key:** copy the key again from Bazarr → Settings → General → Security, then select **Test**.
- **Tunarr can't find or reach Bazarr:** use an address that works from where Tunarr runs. In Docker, put both containers on one network and use Bazarr's container name.
- **Bazarr hasn't found anything yet:** its providers can take a while, so run **Check subtitles** a minute later. If nothing turns up, check Bazarr's subtitle providers; Bazarr logs "All providers are throttled" when none are available.

## Removing the extension

In Settings → Extensions, choose the Bazarr card, then **Uninstall**. This removes the extension, its settings and its saved API key from Tunarr. Nothing changes in Bazarr.

## For developers

This package targets extension API 0.5. `tunarr-extension.json` declares its settings, actions and the two Bazarr requests it makes; `adapter.js` is the code. Tunarr reads updates from [feed-v0.json](feed-v0.json). Older trial hosts keep using [feed-v2.json](feed-v2.json) (API v2) and [feed.json](feed.json) (the Python trial).

Report problems in this repository's [issue tracker](https://github.com/TacoRocket/tunarr-bazarr-extension/issues).
