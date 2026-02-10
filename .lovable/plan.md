

# Fix Link Preview for Questionnaire URLs

## The Problem
When you share a questionnaire link (e.g., `otf-tuscaloosa.lovable.app/q/koa-vincent`) on Instagram or iMessage, the preview shows "OTF T-Town Shift Recap" with a generic Lovable image. This looks unrelated and spammy.

## The Solution: Two Parts

### Part 1 -- Update default meta tags (quick win)
Update `index.html` to show Orangetheory branding by default:
- **Title**: "Orangetheory Fitness Tuscaloosa" (or "OTF Tuscaloosa - Pre-Intro Questionnaire")
- **Description**: Something like "Your personalized fitness journey starts here"
- **OG Image**: Use the OTF logo or an Orangetheory-branded image instead of the generic Lovable one
- **Favicon**: Already set to OTF

This improves ALL link previews site-wide immediately.

### Part 2 -- Dynamic OG tags for questionnaire links (server-side)
Social media crawlers (Instagram, iMessage, etc.) don't run JavaScript, so they only see the static HTML. To show personalized previews per client (e.g., "Koa's Pre-Intro Questionnaire"), we need a backend function that intercepts crawler requests and returns custom HTML with the right meta tags.

**How it works:**
1. Create a backend function (`og-image` or `questionnaire-og`) that:
   - Receives the slug from the URL
   - Looks up the client name from the database
   - Returns an HTML page with customized OG meta tags (title: "Koa's Pre-Intro Questionnaire", description: "Complete your quick questionnaire before your intro class at Orangetheory Fitness Tuscaloosa")
   - Includes a redirect so real users (not crawlers) get sent to the actual questionnaire page

2. This gives you personalized, professional-looking previews when shared on social media

**However**, this approach has a limitation: it requires the questionnaire links to point to the edge function URL first, which makes the URL longer/different. A simpler alternative is to just make the default OG tags Orangetheory-branded (Part 1), which covers 90% of the problem.

## Recommendation
Start with **Part 1 only** -- update the default meta tags to be OTF-branded. This is simple, immediate, and makes every link preview look professional rather than spammy. The title won't say "Shift Recap" anymore, and the image will be OTF-branded.

## Technical Details

### File: `index.html`
- Change `<title>` from "OTF T-Town Shift Recap" to "Orangetheory Fitness Tuscaloosa"
- Update `og:title` and `twitter:title` to match
- Change `og:description` and `description` to something like "Your personalized fitness journey starts here"
- Replace `og:image` and `twitter:image` with the OTF logo (upload a properly sized OG image, ideally 1200x630px, to the public folder)
- Remove the Lovable twitter:site reference

