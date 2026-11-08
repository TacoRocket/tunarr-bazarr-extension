import json
import re
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, ProxyHandler, Request, build_opener


PAGE_SIZE = 200
MAX_MOVIES = 10000
MAX_RESPONSE_BYTES = 4 * 1024 * 1024


class LookupError(Exception):
    pass


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def movie_for_id(base_url, api_key, imdb_id):
    parsed = urlsplit(base_url)
    if (parsed.scheme not in ("http", "https") or not parsed.hostname
            or parsed.username is not None or parsed.password is not None
            or parsed.query or parsed.fragment):
        raise LookupError("Provide the base HTTP or HTTPS URL of the Bazarr service.")
    if not re.fullmatch(r"tt[0-9]{7,12}", imdb_id):
        raise LookupError("Provide a movie IMDb ID.")
    if not api_key or not api_key.isascii() or any(c.isspace() for c in api_key):
        raise LookupError("Provide a Bazarr API key.")

    # A redirect or environment proxy must never receive Bazarr's API key.
    client = build_opener(ProxyHandler({}), NoRedirect())
    endpoint = base_url.rstrip("/") + "/api/movies"
    found = None
    offset = 0
    while offset < MAX_MOVIES:
        req = Request(f"{endpoint}?start={offset}&length={PAGE_SIZE}",
                      headers={"X-API-KEY": api_key, "Accept": "application/json"})
        with client.open(req, timeout=5) as response:
            payload = response.read(MAX_RESPONSE_BYTES + 1)
        if len(payload) > MAX_RESPONSE_BYTES:
            raise LookupError("Bazarr returned a page exceeding the lookup limit.")
        page = json.loads(payload)
        movies, total = page["data"], page["total"]
        if not isinstance(movies, list) or not isinstance(total, int) or total < 0:
            raise LookupError("Bazarr returned invalid movie pagination.")
        if total > MAX_MOVIES:
            raise LookupError("Bazarr's library exceeds the trial lookup limit.")
        for movie in movies:
            if movie["imdbId"] == imdb_id:
                if found is not None and found["radarrId"] != movie["radarrId"]:
                    return {"status": "ambiguous"}
                found = movie
        offset += len(movies)
        if offset >= total:
            return describe(found) if found is not None else {"status": "unmatched"}
        if not movies:
            raise LookupError("Bazarr returned an incomplete movie listing.")
    raise LookupError("Bazarr's library exceeds the trial lookup limit.")


def languages(tracks):
    return sorted({track["code2"] for track in tracks if track.get("code2")})


def describe(movie):
    return {
        "status": "matched",
        "title": movie["title"],
        "installedLanguages": languages(movie["subtitles"]),
        "missingLanguages": (
            languages(movie["missing_subtitles"])
            if movie["profileId"] is not None else None
        ),
    }


def main():
    try:
        config = json.loads(sys.stdin.buffer.read(16385))
        result = movie_for_id(config["bazarrUrl"], config["apiKey"], config["imdbId"])
        line = json.dumps(result, ensure_ascii=True)
        if len(line) > 8192:
            raise LookupError("The movie result exceeds the trial output limit.")
        print(line)
    except HTTPError as exc:
        sys.exit(f"Bazarr returned HTTP {exc.code}.")
    except (URLError, TimeoutError, OSError):
        sys.exit("Cannot reach Bazarr.")
    except LookupError as exc:
        sys.exit(str(exc))
    except (ValueError, KeyError, TypeError, AttributeError):
        sys.exit("Invalid extension input or unexpected Bazarr movie data.")


if __name__ == "__main__":
    main()
