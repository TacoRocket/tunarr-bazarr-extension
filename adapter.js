const pageSize = 200;
const movieLimit = 10000;

function movieImdbId(program) {
  if (program?.type !== "movie") {
    throw new Error("Select a movie from the Tunarr library.");
  }

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
  if (ids.size !== 1) {
    throw new Error("The Tunarr movie needs one exact IMDb identifier for a Bazarr lookup.");
  }
  return ids.values().next().value;
}

function languages(tracks) {
  return [...new Set(tracks.map((track) => track.code2).filter(Boolean))].sort();
}

function readMovies(start, length) {
  const page = readJson("movies", { start, length });
  if (!Array.isArray(page?.data) || !Number.isInteger(page.total) || page.total < 0) {
    throw new Error("Bazarr returned invalid movie pagination.");
  }
  return page;
}

function run(input) {
  if (input.action === "test") {
    readMovies(0, 1);
    return { status: "connected" };
  }
  if (input.action !== "lookup") {
    throw new Error("Unsupported Bazarr action.");
  }
  const imdbId = movieImdbId(input.program);
  let start = 0;
  let match;
  while (start < movieLimit) {
    const { data, total } = readMovies(start, pageSize);
    if (total > movieLimit) {
      throw new Error("Bazarr's library exceeds the 10,000-movie lookup limit.");
    }
    for (const movie of data) {
      if (movie.imdbId !== imdbId) continue;
      if (match && match.radarrId !== movie.radarrId) {
        return { status: "ambiguous" };
      }
      match = movie;
    }
    start += data.length;
    if (start >= total) {
      if (!match) return { status: "unmatched" };
      return {
        status: "matched",
        title: match.title,
        installedLanguages: languages(match.subtitles),
        missingLanguages: match.profileId == null ? null : languages(match.missing_subtitles),
      };
    }
    if (data.length === 0) {
      throw new Error("Bazarr returned an incomplete movie listing.");
    }
  }
  throw new Error("Bazarr's library exceeds the 10,000-movie lookup limit.");
}
