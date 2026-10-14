# Aventrix Realty — Footer Map and Homepage CTA Image Change Report

## Requested changes
1. Restore an actual map preview in the footer's **Find Us** column instead of the text/link-only map card.
2. Use the owner-provided Google Maps share URL for map-opening links:
   `https://maps.app.goo.gl/myyZtBpnsowM2wNb9?g_st=ic`
3. Replace the background image only in the homepage **Ready to Find Your Ideal Property?** CTA section with the uploaded high-rise image.

## Changes made
- Added `images/ready-to-find-property.jpg`, copied from the high-rise image supplied for this change.
- Updated only the `.cta-section` background in `style.css` to use `images/ready-to-find-property.jpg` with the existing green overlay retained.
- Reverted an unrelated stylesheet image reference so other sections were not changed by this task.
- Updated the static footer iframe fallback on all 28 pages containing the footer map.
- Updated `js/public-offices.js` to stop stale CMS `maps_embed_url` / office address values from replacing the selected Head Office map query.
- Kept the supplied Google Maps short URL as the destination for the map links.
- Bumped the `public-offices.js` cache-busting version to `20261016-owner-map` on those 28 pages.

## Important technical distinction
The supplied `maps.app.goo.gl` URL is a Google Maps *share link*, not an embeddable iframe URL. The footer iframe therefore uses a Google Maps `output=embed` query for the published Head Office address (No. 27, 1st Main Road, New Colony, Chromepet, Chennai, Tamil Nadu), while the link opens the exact supplied share URL. The destination encoded by the short link could not be independently resolved during this edit, so the iframe's pin has not been independently verified against the short link.

## Validation performed
- `node --check js/public-offices.js` passed.
- Confirmed the CTA CSS points to `images/ready-to-find-property.jpg`.
- Confirmed the unrelated CTA/background references remain unchanged.
- ZIP archive integrity checked after packaging.

## Not performed
- No Cloudflare deployment was performed.
- No live browser or production verification was performed. The source ZIP is prepared for local review and testing before deployment.
