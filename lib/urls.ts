export function parseInstagramUrl(value: string) {
  if (typeof value !== "string" || value.length > 2048)
    throw new Error("올바른 인스타그램 게시물 링크를 입력해 주세요.");
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("올바른 인스타그램 게시물 링크를 입력해 주세요.");
  }
  const match = url.pathname.match(/^\/(p|reel)\/([A-Za-z0-9_-]{1,64})\/?$/);
  if (
    url.protocol !== "https:" ||
    !["instagram.com", "www.instagram.com"].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.port ||
    !match
  ) {
    throw new Error(
      "유효하지 않은 인스타그램 URL입니다. https://www.instagram.com/p/... 또는 /reel/... 형식을 사용해 주세요.",
    );
  }
  return {
    id: match[2],
    kind: match[1] as "p" | "reel",
    url: `https://www.instagram.com/${match[1]}/${match[2]}/`,
  };
}
export function parseBatchInput(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const urls = lines.filter((line) => {
    let key: string;
    try {
      key = parseInstagramUrl(line).id;
    } catch {
      key = line;
    }
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return {
    urls,
    duplicates: lines.length - urls.length,
    error:
      urls.length > 20
        ? "최대 20개까지만 조회할 수 있습니다."
        : !urls.length
          ? "조회할 링크를 한 줄에 하나씩 입력해 주세요."
          : "",
  };
}
