const SUPABASE_URL = "https://gkrtjeygrqkglsadskcg.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MnbL_7U0x3xvksGpOJxtUQ_DEZ85MGL";
const SITE_ORIGIN = "https://aventrixrealty.com";

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function absoluteImage(value, requestUrl) {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    return new URL(value.trim(), new URL(requestUrl).origin + "/").toString();
  } catch (_) {
    return "";
  }
}

async function propertyShareResponse(request, slug, redirectToProperty = true) {
  if (!slug || !/^[a-zA-Z0-9-]+$/.test(slug)) {
    return new Response("Property not found", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" }
    });
  }

  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: "Bearer " + SUPABASE_ANON_KEY
  };

  // Shared property URLs have historically used the listing ID in
  // property.html?id=..., while newer URLs may use a slug. Try both.
  let property = null;
  try {
    for (const field of ["slug", "id"]) {
      const endpoint = new URL(SUPABASE_URL + "/rest/v1/properties");
      endpoint.searchParams.set("select", "*");
      endpoint.searchParams.set(field, "eq." + slug);
      endpoint.searchParams.set("publish_status", "eq.Published");
      endpoint.searchParams.set("limit", "1");
      const response = await fetch(endpoint.toString(), { headers });
      if (!response.ok) {
        // If a schema does not expose one of the lookup fields, try the other.
        continue;
      }
      const rows = await response.json();
      property = Array.isArray(rows) ? rows[0] : null;
      if (property) break;
    }
  } catch (_) {
    return new Response("Unable to load property. Please open the listing directly.", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" }
    });
  }

  if (!property) {
    return new Response("Property not found", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" }
    });
  }

  const title = (property.title || "Property Listing") + " | Aventrix Realty";
  const description = property.short_description || property.location || "View this property listing on Aventrix Realty.";
  let rawImage = property.featured_image;
  if (!rawImage && Array.isArray(property.images) && property.images.length) {
    const first = property.images[0];
    rawImage = typeof first === "string" ? first : first && (first.url || first.src || first.path);
  }
  const image = SITE_ORIGIN + "/p/" + encodeURIComponent(property.slug || slug) + "/image";
  const shareUrl = new URL(request.url).toString();
  const propertyUrl = SITE_ORIGIN + "/property.html?id=" + encodeURIComponent(property.slug || slug);
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeImage = escapeHtml(image);
  const safePropertyUrl = escapeHtml(propertyUrl);
  const safeShareUrl = escapeHtml(shareUrl);

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${safeTitle}</title>
<meta name="description" content="${safeDescription}">
<link rel="canonical" href="${safeShareUrl}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Aventrix Realty">
<meta property="og:title" content="${safeTitle}">
<meta property="og:description" content="${safeDescription}">
<meta property="og:url" content="${safeShareUrl}">
<meta property="og:image" content="${safeImage}">
<meta property="og:image:secure_url" content="${safeImage}">
<meta property="og:image:alt" content="${escapeHtml(property.title || "Property photo")}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${safeTitle}">
<meta name="twitter:description" content="${safeDescription}">
<meta name="twitter:image" content="${safeImage}">
${redirectToProperty ? `<meta http-equiv="refresh" content="0;url=${safePropertyUrl}"><script>location.replace(${JSON.stringify(propertyUrl)});</script>` : ""}
</head>
<body style="margin:0;font-family:Arial,sans-serif;color:#123b32">
<main style="max-width:760px;margin:24px auto;padding:16px">
<img src="${safeImage}" alt="${escapeHtml(property.title || "Property photo")}" style="display:block;width:100%;height:auto;max-height:65vh;object-fit:cover;border-radius:12px">
<h1>${safeTitle}</h1>
<p>${safeDescription}</p>
<p>${escapeHtml(property.location || "")}</p>
<a href="${safePropertyUrl}" style="display:inline-block;padding:12px 18px;background:#123b32;color:#fff;text-decoration:none;border-radius:8px">View Full Property Details</a>
</main>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=60, s-maxage=300",
      "x-content-type-options": "nosniff"
    }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/p/")) {
      const pathPart = decodeURIComponent(url.pathname.slice(3).replace(/\/$/, ""));
      const imageMatch = pathPart.match(/^([a-zA-Z0-9-]+)\/image$/);
      if (imageMatch) {
        const slug = imageMatch[1];
        const headers = { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + SUPABASE_ANON_KEY };
        let property = null;
        for (const field of ["slug", "id"]) {
          const endpoint = new URL(SUPABASE_URL + "/rest/v1/properties");
          endpoint.searchParams.set("select", "slug,featured_image,images");
          endpoint.searchParams.set(field, "eq." + slug);
          endpoint.searchParams.set("publish_status", "eq.Published");
          endpoint.searchParams.set("limit", "1");
          const response = await fetch(endpoint.toString(), { headers });
          if (!response.ok) continue;
          const rows = await response.json();
          property = Array.isArray(rows) ? rows[0] : null;
          if (property) break;
        }
        if (!property) return new Response("Image not found", { status: 404 });
        const firstImage = Array.isArray(property.images) ? property.images[0] : "";
        const imageUrl = absoluteImage(property.featured_image || firstImage, request.url);
        if (!imageUrl) return new Response("Image not found", { status: 404 });
        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) return new Response("Image unavailable", { status: 502 });
        return new Response(imageResponse.body, { status: 200, headers: {
          "content-type": imageResponse.headers.get("content-type") || "image/jpeg",
          "cache-control": "public, max-age=3600, s-maxage=86400",
          "x-content-type-options": "nosniff",
          "access-control-allow-origin": "*"
        }});
      }
      return propertyShareResponse(request, pathPart);
    }
    // Social crawlers cannot execute JavaScript that loads property details.
    // Serve server-rendered property metadata for direct shared property URLs.
    if (url.pathname === "/property.html" && url.searchParams.has("id")) {
      const ua = request.headers.get("user-agent") || "";
      const crawler = /WhatsApp|facebookexternalhit|Facebot|Twitterbot|LinkedInBot|Slackbot|TelegramBot|Discordbot/i.test(ua);
      const slug = url.searchParams.get("id") || "";
      if (crawler && slug) return propertyShareResponse(request, slug, false);
    }
    return env.ASSETS.fetch(request);
  }
};
