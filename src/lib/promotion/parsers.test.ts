import { describe, expect, test } from "bun:test";
import {
  parseAudiomackInput,
  parseBoomplayInput,
  parseAppleMusicInput,
  parseSpotifyInput,
  parseYoutubeInput,
} from "./parsers";
import { formatCompactCount, syncCooldownRemainingMs, PROMOTION_SYNC_COOLDOWN_MS } from "./types";

describe("parseSpotifyInput", () => {
  test("accepts artist URLs, URIs and bare ids", () => {
    expect(parseSpotifyInput("https://open.spotify.com/artist/0TnOYISbd1XYRBk9myaseg?si=abc")).toEqual({
      kind: "id",
      id: "0TnOYISbd1XYRBk9myaseg",
    });
    expect(parseSpotifyInput("spotify:artist:0TnOYISbd1XYRBk9myaseg")).toEqual({
      kind: "id",
      id: "0TnOYISbd1XYRBk9myaseg",
    });
    expect(parseSpotifyInput("0TnOYISbd1XYRBk9myaseg")).toEqual({ kind: "id", id: "0TnOYISbd1XYRBk9myaseg" });
  });
  test("falls back to search for names and rejects wrong-platform URLs", () => {
    expect(parseSpotifyInput("Burna Boy")).toEqual({ kind: "search", query: "Burna Boy" });
    expect(parseSpotifyInput("https://youtube.com/@x")).toBeNull();
    expect(parseSpotifyInput("https://open.spotify.com/track/0TnOYISbd1XYRBk9myaseg")).toBeNull();
    expect(parseSpotifyInput("")).toBeNull();
  });
});

describe("parseAppleMusicInput", () => {
  test("parses artist URLs with and without slug", () => {
    expect(parseAppleMusicInput("https://music.apple.com/ng/artist/burna-boy/1189007191")).toEqual({
      kind: "id",
      id: "1189007191",
    });
    expect(parseAppleMusicInput("https://music.apple.com/artist/1189007191")).toEqual({
      kind: "id",
      id: "1189007191",
    });
    expect(parseAppleMusicInput("1189007191")).toEqual({ kind: "id", id: "1189007191" });
    expect(parseAppleMusicInput("Tems")).toEqual({ kind: "search", query: "Tems" });
    expect(parseAppleMusicInput("https://open.spotify.com/artist/0TnOYISbd1XYRBk9myaseg")).toBeNull();
  });
});

describe("parseYoutubeInput", () => {
  test("parses channel ids, handles and legacy urls", () => {
    expect(parseYoutubeInput("https://www.youtube.com/channel/UCX6OQ3DkcsbYNE6H8uQQuVA")).toEqual({
      kind: "id",
      id: "UCX6OQ3DkcsbYNE6H8uQQuVA",
    });
    expect(parseYoutubeInput("https://www.youtube.com/@MrBeast")).toEqual({ kind: "handle", handle: "MrBeast" });
    expect(parseYoutubeInput("@MrBeast")).toEqual({ kind: "handle", handle: "MrBeast" });
    expect(parseYoutubeInput("MrBeast")).toEqual({ kind: "handle", handle: "MrBeast" });
    expect(parseYoutubeInput("https://www.youtube.com/c/SomeChannel")).toEqual({
      kind: "search",
      query: "SomeChannel",
    });
    expect(parseYoutubeInput("Lofi Beats Radio")).toEqual({ kind: "search", query: "Lofi Beats Radio" });
    expect(parseYoutubeInput("https://audiomack.com/x")).toBeNull();
  });
});

describe("parseAudiomackInput", () => {
  test("parses artist URLs and bare slugs, searches names", () => {
    expect(parseAudiomackInput("https://audiomack.com/burna-boy")).toEqual({ kind: "slug", slug: "burna-boy" });
    expect(parseAudiomackInput("https://audiomack.com/burna-boy/")).toEqual({ kind: "slug", slug: "burna-boy" });
    expect(parseAudiomackInput("burna-boy")).toEqual({ kind: "slug", slug: "burna-boy" });
    expect(parseAudiomackInput("Burna Boy")).toEqual({ kind: "search", query: "Burna Boy" });
    expect(parseAudiomackInput("https://audiomack.com/charts")).toBeNull();
  });
});

describe("parseBoomplayInput", () => {
  test("accepts only boomplay artist/share URLs and normalizes them", () => {
    const r = parseBoomplayInput("https://www.boomplay.com/artists/12345678#tab");
    expect(r).toEqual({ kind: "url", url: "https://www.boomplay.com/artists/12345678" });
    expect(parseBoomplayInput("https://www.boomplay.com/share/artist/99")).toEqual({
      kind: "url",
      url: "https://www.boomplay.com/share/artist/99",
    });
    expect(parseBoomplayInput("Boomplay Artist")).toBeNull();
    expect(parseBoomplayInput("https://open.spotify.com/artist/0TnOYISbd1XYRBk9myaseg")).toBeNull();
    expect(parseBoomplayInput("https://www.boomplay.com/")).toBeNull();
  });
});

describe("syncCooldownRemainingMs", () => {
  test("allows sync when never synced or past the cooldown", () => {
    const now = Date.now();
    expect(syncCooldownRemainingMs(null, now)).toBe(0);
    expect(syncCooldownRemainingMs(new Date(now - PROMOTION_SYNC_COOLDOWN_MS - 1000).toISOString(), now)).toBe(0);
  });
  test("reports the remaining window inside the cooldown", () => {
    const now = Date.now();
    const fiveMinAgo = new Date(now - 5 * 60_000).toISOString();
    expect(syncCooldownRemainingMs(fiveMinAgo, now)).toBe(PROMOTION_SYNC_COOLDOWN_MS - 5 * 60_000);
  });
});

describe("formatCompactCount", () => {
  test("formats small, large and missing values", () => {
    expect(formatCompactCount(999)).toBe("999");
    expect(formatCompactCount(1_250_000)).toBe("1.3M");
    expect(formatCompactCount(null)).toBe("—");
    expect(formatCompactCount(undefined)).toBe("—");
  });
});
