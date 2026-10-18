export async function onRequest({ params, request }) {
  const slug = String(params.slug || "").trim();
  if (!slug || !/^[a-zA-Z0-9-]+$/.test(slug)) {
    return new Response("Property not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  }

  const supabaseUrl = "https://gkrtjeygrqkglsadskcg.supabase.co";
  const anonKey = "sb_publishable_MnbL_7U0x3xvksGpOJxtUQ_DEZ85MGL";
  const endpoint = new URL(supabaseUrl + "/rest/v1/properties");
  endpoint.searchParams.set("select", "title,slug,short_description,featured_image,images,location,price");
  endpoint.searchParams.set("slug", "eq." + slug);
  endpoint.searchParams.set("publish_status", "eq.Published");
  endpoint.searchParams.set("limit", "1");

  let property;
  try {
    const response = await fetch(endpoint.toString(), {
      headers: { apikey: anonKey, Authorization: "Bearer " + anonKey }
    });
    if (!response.ok) throw new Error("Property lookup failed");
    const rows = await response.json();
    property = rows && rows[0];
  } catch (_) {
    return new Response("Unable to load property preview", { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } });
  }

  if (!property) {
    return new Response("Property not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  }

  const escapeHtml = (value) => String(value == null ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const title = (property.title || "Property Listing") + " | Aventrix Realty";
  const description = property.short_description || property.location || "View this property listing on Aventrix Realty.";
  // Prefer the listing's featured image; otherwise use its first gallery image.
  // Gallery entries may be plain URLs or objects such as { url }, { src } or { path }.
  let image = property.featured_image || "";
  if (!image && Array.isArray(property.images) && property.images.length) {
    const first = property.images[0];
    image = typeof first === "string" ? first : first && (first.url || first.src || first.path) || "";
  }
  try {
    if (image && !/^https?:\/\//i.test(image)) {
      image = new URL(String(image).replace(/^\//, ""), new URL(request.url).origin + "/").toString();
    }
  } catch (_) {
    image = "";
  }
  if (!image) image = "https://aventrixrealty.com/images/og/aventrix-logo-og.jpg";

  const propertyUrl = "https://aventrixrealty.com/property.html?id=" + encodeURIComponent(slug);
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${escapeHtml(propertyUrl)}">
<meta property="og:type" content="website"><meta property="og:site_name" content="Aventrix Realty">
<meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${escapeHtml(new URL(request.url).toString())}">
<meta property="og:image" content="${escapeHtml(image)}"><meta property="og:image:secure_url" content="${escapeHtml(image)}">
<meta property="og:image:alt" content="${escapeHtml(property.title || "Property photo")}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}"><meta name="twitter:image" content="${escapeHtml(image)}">
<meta http-equiv="refresh" content="0;url=${escapeHtml(propertyUrl)}">
<script>location.replace(${JSON.stringify(propertyUrl)});</script>
</head><body><p>Opening property listing… <a href="${escapeHtml(propertyUrl)}">Continue</a></p></body></html>`;
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=300, s-maxage=1800",
      "x-content-type-options": "nosniff"
    }
  });
}
