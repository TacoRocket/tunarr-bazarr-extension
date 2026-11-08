import json
from http.client import HTTPException
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


def run(config):
    base_url = config["bazarrUrl"]
    api_key = config.get("apiKey", "")
    action = config.get("action", "lookup")
    if action not in ("lookup", "test"):
        raise LookupError("Unsupported Bazarr action.")
    parsed = urlsplit(base_url)
    if (parsed.scheme not in ("http", "https") or not parsed.hostname
            or parsed.username is not None or parsed.password is not None
            or parsed.query or parsed.fragment):
        raise LookupError("Provide the base HTTP or HTTPS URL of the Bazarr service.")
    imdb_id = config.get("imdbId", "")
    if action == "lookup" and not re.fullmatch(r"tt[0-9]{7,12}", imdb_id):
        raise LookupError("Provide a movie IMDb ID.")
    headers = {"Accept": "application/json"}
    if api_key:
        if not api_key.isascii() or not api_key.isprintable() or any(c.isspace() for c in api_key):
            raise LookupError("Provide a valid Bazarr API key.")
        headers["X-API-KEY"] = api_key

    # A redirect or environment proxy must never receive Bazarr's API key.
    client = build_opener(ProxyHandler({}), NoRedirect())
    endpoint = base_url.rstrip("/") + "/api/movies"
    page_size = 1 if action == "test" else PAGE_SIZE
    found = None
    offset = 0
    while offset < MAX_MOVIES:
        req = Request(f"{endpoint}?start={offset}&length={page_size}", headers=headers)
        with client.open(req, timeout=5) as response:
            payload = response.read(MAX_RESPONSE_BYTES + 1)
        if len(payload) > MAX_RESPONSE_BYTES:
            raise LookupError("Bazarr returned a page exceeding the lookup limit.")
        page = json.loads(payload)
        movies, total = page["data"], page["total"]
        if not isinstance(movies, list) or not isinstance(total, int) or total < 0:
            raise LookupError("Bazarr returned invalid movie pagination.")
        if action == "test":
            return {"status": "connected"}
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
    }


def main():
    try:
        config = json.loads(sys.stdin.buffer.read(16385))
        result = run(config)
        line = json.dumps(result, ensure_ascii=True)
        if len(line) > 8192:
            raise LookupError("The movie result exceeds the trial output limit.")
        print(line)
    except HTTPError as exc:
        if exc.code in (401, 403):
            sys.exit(f"Bazarr returned HTTP {exc.code}. Enter the API key from Bazarr Settings → General.")
        sys.exit(f"Bazarr returned HTTP {exc.code}.")
    except (URLError, HTTPException, TimeoutError, OSError):
        sys.exit("Cannot reach Bazarr.")
    except LookupError as exc:
        sys.exit(str(exc))
    except (ValueError, KeyError, TypeError, AttributeError):
        sys.exit("Invalid extension input or unexpected Bazarr movie data.")


if __name__ == "__main__":
    main()
