/**
 * Handles that are reserved because they occupy the first URL segment
 * and would collide with real routes or well-known paths.
 */
export const RESERVED_HANDLES = new Set([
  "login",
  "signup",
  "signout",
  "dashboard",
  "new",
  "auth",
  "confirm",
  "onboarding",
  "api",
  "_next",
  "r",
  "public",
  "static",
  "assets",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
]);
