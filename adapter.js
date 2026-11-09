// Bazarr extension for Tunarr, extension API 0.5.
//
// Tunarr can ask this provider for one subtitle after local preparation.
// The manual search action follows the movie's language profile in Bazarr.

const pageSize = 200;
// Leaves room in the 50-request budget for the search and its re-checks.
const movieLimit = 9000;
const recheckCount = 4;
const recheckSeconds = 5;
// Stop re-checking early enough to answer inside the 30-second action limit.
const answerBySeconds = 24;

// 9000 -> "9,000". The sandbox has no locale formatting.
function count(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function movieImdbId(program) {
  const ids = new Set();
  for (const identifier of program.identifiers ?? []) {
    if (
      identifier?.type === "imdb" &&
      typeof identifier.id === "string" &&
      /^tt[0-9]{7,12}$/.test(identifier.id)
    ) {
      ids.add(identifier.id);
    }
  }
  return ids.size === 1 ? ids.values().next().value : undefined;
}

function selectedMovieId(program) {
  if (program?.type !== "movie") {
    throw new Error("Choose a movie. This extension checks movies only.");
  }
  const id = movieImdbId(program);
  if (!id) {
    throw new Error(
      "Bazarr matches movies by IMDb ID, and this movie doesn't have exactly one.",
    );
  }
  return id;
}

function readPage(start, length) {
  const page = request("movies", { query: { start, length } });
  if (!Array.isArray(page?.data) || !Number.isInteger(page.total)) {
    throw new Error("Bazarr sent a movie list this extension can't read.");
  }
  return page;
}

function findMovie(imdbId) {
  let start = 0;
  let match;
  for (;;) {
    const { data, total } = readPage(start, pageSize);
    if (total > movieLimit) {
      throw new Error(
        `Bazarr's library has more than ${count(movieLimit)} movies, which this version can't search.`,
      );
    }
    for (const movie of data) {
      if (movie.imdbId !== imdbId) continue;
      if (match && match.radarrId !== movie.radarrId) {
        throw new Error("Bazarr has two movies with this IMDb ID.");
      }
      match = movie;
    }
    start += data.length;
    if (start >= total) return match;
    if (data.length === 0) {
      throw new Error("Bazarr sent an incomplete movie list.");
    }
  }
}

function readMovie(radarrId) {
  const page = request("movies", { query: { "radarrid[]": [radarrId] } });
  const movie = Array.isArray(page?.data) ? page.data[0] : undefined;
  if (!movie) throw new Error("Bazarr no longer has this movie.");
  return movie;
}

function languageNames(tracks) {
  const names = new Set();
  for (const track of tracks ?? []) {
    const name = track?.name || track?.code2;
    if (typeof name === "string" && name) names.add(name);
  }
  return [...names].sort();
}

function list(names) {
  if (names.length <= 1) return names.join("");
  return names.slice(0, -1).join(", ") + " and " + names[names.length - 1];
}

function subtitles(movie) {
  return {
    found: languageNames(movie.subtitles),
    stillMissing: languageNames(movie.missing_subtitles),
  };
}

function noProfile(movie) {
  return {
    message: `Bazarr has no language profile for ${movie.title}, so it isn't looking for subtitles.`,
    tone: "info",
    details: subtitles(movie),
  };
}

function check(input) {
  const movie = findMovie(selectedMovieId(input.program));
  if (!movie) {
    return {
      message: "Bazarr doesn't have this movie in its library.",
      tone: "info",
    };
  }
  if (movie.profileId == null) return noProfile(movie);
  const details = subtitles(movie);
  if (details.stillMissing.length === 0) {
    return {
      message: `Bazarr has every subtitle ${movie.title}'s profile asks for.`,
      tone: "success",
      details,
    };
  }
  return {
    message: `Bazarr hasn't found ${list(details.stillMissing)} subtitles for ${movie.title} yet. Use Search for missing subtitles to ask it to look.`,
    tone: "info",
    details,
  };
}

function search(input, startedAt) {
  const movie = findMovie(selectedMovieId(input.program));
  if (!movie) {
    return {
      message:
        "Bazarr doesn't have this movie in its library, so it can't search for it.",
      tone: "info",
    };
  }
  if (movie.profileId == null) return noProfile(movie);
  const before = subtitles(movie);
  if (before.stillMissing.length === 0) {
    return {
      message: `Bazarr already has every subtitle ${movie.title}'s profile asks for.`,
      tone: "success",
      details: before,
    };
  }

  // Bazarr queues the search and answers at once; check back a few times.
  request("searchMissing", {
    query: { radarrid: movie.radarrId, action: "search-missing" },
  });
  let after = before;
  for (let i = 0; i < recheckCount; i++) {
    if ((Date.now() - startedAt) / 1000 + recheckSeconds > answerBySeconds) {
      break;
    }
    wait(recheckSeconds);
    after = subtitles(readMovie(movie.radarrId));
    if (after.stillMissing.length === 0) break;
  }

  const found = before.stillMissing.filter(
    (name) => !after.stillMissing.includes(name),
  );
  if (found.length === 0) {
    return {
      message: `Bazarr is searching for ${list(before.stillMissing)} subtitles for ${movie.title} but hasn't found any yet. Check again in a minute; if nothing turns up, check Bazarr's subtitle providers.`,
      tone: "info",
      details: after,
    };
  }
  const rest =
    after.stillMissing.length > 0
      ? ` Still missing: ${list(after.stillMissing)}.`
      : "";
  return {
    message: `Bazarr found ${list(found)} subtitles for ${movie.title}.${rest}`,
    tone: "success",
    details: after,
  };
}

function requestSubtitle(input) {
  if (input.program?.type !== "movie" || input.language !== "eng") {
    return { status: "unavailable" };
  }
  const imdbId = movieImdbId(input.program);
  const movie = imdbId && findMovie(imdbId);
  if (!movie) return { status: "unavailable" };

  // Bazarr also lists embedded tracks here, including the PGS track Tunarr just tried.
  const hasMatchingSidecar = movie.subtitles?.some((track) =>
    track.code2 === "en" &&
    track.hi === input.sdh &&
    track.forced === input.forced &&
    typeof track.path === "string" &&
    /\.(srt|ass)$/i.test(track.path),
  );
  if (hasMatchingSidecar) return { status: "available" };
  if (movie.profileId == null) {
    return { status: "unavailable" };
  }

  request("searchTrack", {
    query: {
      radarrid: movie.radarrId,
      language: "en",
      hi: String(input.sdh),
      forced: String(input.forced),
    },
  });
  return { status: "requested" };
}

function run(input) {
  const startedAt = Date.now();
  switch (input.action) {
    case "test": {
      const { total } = readPage(0, 1);
      return {
        message: `Bazarr is connected and knows ${count(total)} ${total === 1 ? "movie" : "movies"}.`,
        tone: "success",
      };
    }
    case "subtitle.request":
      return requestSubtitle(input);
    case "lookup":
      return check(input);
    case "search":
      return search(input, startedAt);
    default:
      throw new Error("This version of the Bazarr extension doesn't know that action.");
  }
}
