import type { CollectionEntry } from "astro:content";

/**
 * Determines whether a post is eligible to be listed/rendered.
 *
 * - In production, excludes drafts and scheduled posts until `pubDatetime`
 * - In dev, shows every post so drafts and scheduled posts can be previewed
 */
export function postFilter({ data }: CollectionEntry<"posts">) {
  const isPublishTimePassed =
    Date.now() >= new Date(data.pubDatetime).getTime();
  return import.meta.env.DEV || (!data.draft && isPublishTimePassed);
}
