const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");

const adapter = readFileSync(path.join(__dirname, "../adapter.js"), "utf8");
const imdbId = "tt1234567";
const program = { type: "movie", identifiers: [{ type: "imdb", id: imdbId }] };

for (const { name, page, message } of [
  {
    name: "over the library limit",
    page: { total: 9001, data: [] },
    message: "Bazarr's library has more than 9,000 movies, which this version can't search.",
  },
  {
    name: "two Radarr movies with the same IMDb ID",
    page: { total: 2, data: [{ imdbId, radarrId: 1 }, { imdbId, radarrId: 2 }] },
    message: "Bazarr has two movies with this IMDb ID.",
  },
]) {
  test(name, () => {
    const sandbox = vm.createContext({
      request(endpoint) {
        assert.equal(endpoint, "movies");
        return page;
      },
    });
    vm.runInContext(adapter, sandbox);
    for (const action of ["lookup", "search"]) {
      assert.throws(() => sandbox.run({ action, program }), { message });
    }
    const result = sandbox.run({ action: "subtitle.request", program, language: "eng", sdh: false, forced: false });
    assert.equal(result.status, "unavailable");
  });
}
