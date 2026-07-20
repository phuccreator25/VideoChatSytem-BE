import { MESSAGE_REPOSITORY } from "../../repository/message.repository.js";

export const onGetShareMedia = async ({ conversationId, limit, skip }) => {
  try {
    if (!conversationId) return;

    const messages = await MESSAGE_REPOSITORY.onGetShareMedia(
      conversationId,
      limit,
      skip
    );

    return messages;
  } catch (error) {
    throw error;
  }
};

export const onGetShareFiles = async ({ conversationId, limit, skip }) => {
  try {
    if (!conversationId) return;

    const messages = await MESSAGE_REPOSITORY.onGetShareFiles(
      conversationId,
      limit,
      skip
    );

    return messages;
  } catch (error) {
    throw error;
  }
};

export const onGetShareLinks = async ({ conversationId, limit, skip }) => {
  try {
    if (!conversationId) return;

    const messages = await MESSAGE_REPOSITORY.onGetShareLinks(
      conversationId,
      limit,
      skip
    );

    return messages;
  } catch (error) {
    throw error;
  }
};

export const onGetLinkPreview = async ({ url }) => {
  try {
    if (!url) return null;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch page: ${response.statusText}`);
    }

    const html = await response.text();

    const getMetaTag = (html, property) => {
      const regex = new RegExp(`<meta[^>]*property=["']${property}["'][^>]*content=["']([^"']*)["']`, "i");
      let match = html.match(regex);
      if (match) return match[1];

      const regexName = new RegExp(`<meta[^>]*name=["']${property}["'][^>]*content=["']([^"']*)["']`, "i");
      match = html.match(regexName);
      if (match) return match[1];

      const regexRev = new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*property=["']${property}["']`, "i");
      match = html.match(regexRev);
      if (match) return match[1];

      const regexNameRev = new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*name=["']${property}["']`, "i");
      match = html.match(regexNameRev);
      if (match) return match[1];

      return null;
    };

    const title = getMetaTag(html, "og:title") || getMetaTag(html, "twitter:title") || (html.match(/<title>([^<]*)<\/title>/i) || [])[1] || "";
    const description = getMetaTag(html, "og:description") || getMetaTag(html, "twitter:description") || getMetaTag(html, "description") || "";
    let image = getMetaTag(html, "og:image") || getMetaTag(html, "twitter:image") || "";

    if (image && image.startsWith("/")) {
      const parsedUrl = new URL(url);
      image = `${parsedUrl.origin}${image}`;
    }

    const siteName = getMetaTag(html, "og:site_name") || "";

    let domain = "";
    try {
      const parsedUrl = new URL(url);
      domain = parsedUrl.hostname.replace("www.", "");
    } catch (e) {
      // Ignored
    }

    return {
      title: title.trim(),
      description: description.trim(),
      image,
      url,
      siteName: siteName.trim(),
      domain
    };
  } catch (error) {
    console.error("Link preview error:", error.message);
    try {
      const parsedUrl = new URL(url);
      const domain = parsedUrl.hostname.replace("www.", "");
      return {
        title: domain.charAt(0).toUpperCase() + domain.slice(1),
        description: "Shared web link",
        image: "",
        url,
        siteName: domain,
        domain
      };
    } catch (e) {
      return null;
    }
  }
};
