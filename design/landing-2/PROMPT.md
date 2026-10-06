# Build: Home saas

Rebuild the website https://covex-template.webflow.io/home-01 shown in this folder as a working front end. Match the layout, sizes, colours, type and motion; use placeholder copy and images where the originals are not included.

## Files
- `walkthrough.mp4`: the narrated walkthrough. It pauses on each screen while the narrator explains how it looks and moves.
- `walkthrough.srt`: the narration as timed text.
- `screens/`: one still per section, in page order.

## Stack
- Framework: Webflow site builder
- Seen in the site's code: GSAP (scroll-driven animations and reveal tweens), ScrollTrigger (scroll timeline control), SplitText (text-splitting animation), jQuery (DOM scripting support), Lottie (vector animation player)
- Fonts: Bdogrotesk 500, Interdisplay 400/500

## Design system
- Palette: Soft off-white page background, near #F7F6F4 used site-wide; primary text very dark grey, near #111111 for headlines; body text mid-grey about #6F6F6F; accent gradient panels warm red-orange to blue used in hero and CTA (red tone hex C33A36 referenced); buttons dark rounded primary filled black-ish #222222 for solid CTAs and light grey #F0F0F0 for secondary; success and micro-badges use green hex 2EB886 in UI cards.
- Typography: Looks like a geometric grotesque for headings (looks like Bdogrotesk 500, heavy display at 48px for hero) and a humanist sans for body (looks like Interdisplay 400 at 16px). Headline weight 500 at large sizes, body 400 regular; tight letter spacing for headings, normal for body; labels small caps-like but regular case. Scale: hero 48 pixel weight 500, subheading 36 pixel weight 500, body 16 pixel weight 400.
- Shape: Large soft corner radius on cards about 24 pixel radius; smaller UI chips and buttons use 22 pixel radius for pill-like buttons; subtle 1 pixel borders in very light grey for dividers; cards use soft drop shadow very faint, panels use rounded 24 pixel corners.
- Spacing: Centered 12-column-like layout with wide gutters, horizontal content constrained with large side margins (about 160 pixels left/right on 1600 width). Vertical rhythm generous: section spacing about 120 pixels; card grid three across at 1600 width, cards approx 360 pixels wide.
- Iconography: Outline system icons, thin strokes about 2 pixel visually, consistent rounded terminals, 24 to 28 pixel sizes for inline icons, small 16 pixel icons for nav. Social icons monochrome filled variants for footer.
- Imagery: Photos are warm editorial portraits, tightly cropped with consistent rounded corners. Gradient hero/feature panels use soft grain overlay and vignette. Product UI screenshots inset with white cards and subtle shadows.
- Motion: GSAP-driven scroll reveals and ScrollTrigger animations active; carousel/row scrolls for team and integrations; IntersectionObserver reveals for cards; hero CTA fade and rise; Lottie used for at least one vector animation. Sticky header on top.

## Sections, top to bottom

1. **Hero / top navigation** (screens/01-hero-top-navigation.jpg, video 0:00)
   Build a hero with centered two-column layout: left column headline 48 pixel weight 500, 24 pixel corner on hero image, primary CTA 44 pixels tall with 22 pixel radius and dark background (#222222), secondary CTA light grey 44 pixels tall with 22 pixel radius. Use GSAP SplitText and ScrollTrigger for staggered reveal and CSS sticky header.
   Motion: Hero text split and reveal with GSAP SplitText; sticky header.

2. **Feature split — heading left, hero art right** (screens/02-feature-split-heading-left-hero-art-righ.jpg, video 0:56)
   Create a two-column feature block: left text column 520 pixels wide with 36px headline weight 500; right artwork 420 pixels high with 24px radius. Animate the artwork with a gentle fade and upward motion using GSAP ScrollTrigger.

3. **Statistic counter and CTA** (screens/03-statistic-counter-and-cta.jpg, video 1:19)
   Add a large stat component with GSAP tween counting animation. Include carousel dots centered and clickable, connected to the testimonial carousel.
   Motion: Number reveal and carousel dots animated.

4. **Testimonials carousel** (screens/04-testimonials-carousel.jpg, video 1:30)
   Create a horizontal carousel of three 360x240 testimonial cards with 24px radius, 40px avatars, and GSAP-controlled snapping and easing.
   Motion: Horizontal carousel with active highlight.

5. **Integrations row and CTA** (screens/05-integrations-row-and-cta.jpg, video 1:33)
   Build integration tiles 260x260 with centered 48px outline icons, hover lift using GSAP scale to 1.03 and transition 200ms.
   Motion: Hover lift for tiles.

6. **Features headline and cards** (video 1:42)
   Implement a three-column features grid with 360x320 cards, 24px radius, and staggered reveal using GSAP ScrollTrigger.
   Motion: Card reveal on scroll.

7. **Footer top and signup area** (screens/07-footer-top-and-signup-area.jpg, video 2:01)
   Create footer grid with left contact column and four link columns, columns about 200px wide and footer top padding 80px.

8. **Team carousel / hero stats row** (screens/08-team-carousel-hero-stats-row.jpg, video 2:11)
   Implement 4 stat blocks across 1200px container with GSAP fade-in when scrolled into view.
   Motion: Stat blocks reveal.

9. **Jobs list and CTA** (screens/09-jobs-list-and-cta.jpg, video 2:18)
   Create careers list with rows 56px tall, separators 1px light grey, and right-aligned 44px dark pill 'Apply now' buttons.

10. **Case study heading and content** (screens/10-case-study-heading-and-content.jpg, video 2:45)
   Render case study content with body 16px Interdisplay, max content width about 700px, and GSAP reveal for headings.

11. **Results section and large red CTA panel below** (screens/11-results-section-and-large-red-cta-panel-.jpg, video 2:48)
   Add a full-bleed rounded CTA panel 1100x420 centered with 24px radius, white CTA 44px high, and a small parallax offset applied to the background using GSAP ScrollTrigger.
   Motion: Big CTA panel appears with subtle parallax.

12. **FAQ accordion area** (screens/12-faq-accordion-area.jpg, video 3:06)
   Implement FAQ accordion items 56px tall with a plus icon, animate open/close with GSAP height tween.
   Motion: Accordion open/close.

13. **Client logos row and newsletter CTA panel** (screens/13-client-logos-row-and-newsletter-cta-pane.jpg, video 3:15)
   Build newsletter gradient panel with input 420px and subscribe button 44px high, animate reveal with GSAP.
   Motion: Newsletter panel subtle reveal.

14. **Pricing comparison table and CTA panel** (screens/14-pricing-comparison-table-and-cta-panel.jpg, video 3:18)
   Create a three-column pricing table with 56px rows, 16px green check icons, and GSAP reveal for the table.
   Motion: Table reveal and CTA parallax.

15. **Image gallery tiles** (screens/15-image-gallery-tiles.jpg, video 3:27)
   Implement an image tile grid with tiles sized around 300-520px and hover scale to 1.02 using CSS transform and GSAP for smoothness.
   Motion: Hover scale on images.

16. **Profile split and values grid** (screens/16-profile-split-and-values-grid.jpg, video 3:31)
   Create profile split with portrait 360x360 radius 24px and a 3x3 values grid with thin dividers; reveal with GSAP when visible.

17. **Team carousel / card list** (screens/17-team-carousel-card-list.jpg, video 3:37)
   Build a horizontal team carousel with cards 300x420, portrait 300x300, 24px radii, and arrow controls 44px diameter. Use GSAP for smooth translateX animation.
   Motion: Horizontal scroll carousel with arrows.

18. **Office locations map and CTA** (screens/18-office-locations-map-and-cta.jpg, video 4:05)
   Add map with decorative pins and three address columns each about 320px wide; reveal pins with GSAP.

19. **Blog / articles grid** (screens/19-blog-articles-grid.jpg, video 4:25)
   Create a three-column blog grid with cards 360x300, badge top-left, and hover overlay bringing up meta using GSAP transitions.
   Motion: Cards reveal with hover overlay.

20. **Blog card hover preview** (screens/20-blog-card-hover-preview.jpg, video 4:30)
   Implement article card hover overlay 320x220 with 16px radius, animate overlay opacity and title using GSAP and SplitText.
   Motion: Hover overlay with SplitText micro animation.

21. **More blog list and thumbnails** (screens/21-more-blog-list-and-thumbnails.jpg, video 4:35)
   Render additional article tiles 260px square with 16px radius and reveal on scroll via GSAP.

22. **Integrations detail grid** (screens/22-integrations-detail-grid.jpg, video 4:59)
   Create integration cards roughly 320x180, with hover elevation using GSAP scale and z-index change.
   Motion: Hover elevate active tile.

23. **Article content and inline image** (screens/23-article-content-and-inline-image.jpg, video 5:09)
   Render article content with body at 16px, max width 700px, and inline image 640x240 with 16px radius; animate headings with GSAP.

24. **Sign up heading and CTA panel** (screens/24-sign-up-heading-and-cta-panel.jpg, video 5:36)
   Create Sign Up heading and CTA panel similar to other CTAs; implement a dimmed state via a CSS class toggled by JS, animated with GSAP.
   Motion: CTA may dim on non-interactive pages.

25. **Changelog / single heading** (screens/25-changelog-single-heading.jpg, video 5:46)
   Render a simple changelog header centered with description and consistent page spacing.

26. **Licenses page header and icon credits** (screens/26-licenses-page-header-and-icon-credits.jpg, video 5:55)
   Add license page with boxed credit area and standard body text styling at 16px.

## Done when
- Every section above exists, in order, and matches its still at the same width.
- Motion and scroll behaviour match the video.
- It builds and runs with no console errors.
