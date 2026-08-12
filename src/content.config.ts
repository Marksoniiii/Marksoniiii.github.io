import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { glob } from "astro/loaders";
import config from "@/config";

export const BLOG_PATH = "src/content/posts";

const posts = defineCollection({
  loader: glob({ pattern: "**/[^_]*.{md,mdx}", base: `./${BLOG_PATH}` }),
  schema: ({ image }) =>
    z.object({
      author: z.string().default(config.site.author),
      pubDatetime: z.date(),
      modDatetime: z.preprocess(
        value => (value === "" ? undefined : value),
        z.date().optional().nullable()
      ),
      title: z.string().trim().min(1).max(120),
      featured: z.boolean().default(false),
      draft: z.boolean().default(true),
      tags: z.array(z.string().trim().min(1)).min(1).default(["其他"]),
      ogImage: z.preprocess(
        value => (value === "" ? undefined : value),
        image().or(z.string()).optional()
      ),
      description: z.string().trim().min(1).max(240),
      canonicalURL: z.preprocess(
        value => (value === "" ? undefined : value),
        z.url().optional()
      ),
      hideEditPost: z.boolean().optional(),
      timezone: z.string().optional(),
    }),
});

const pages = defineCollection({
  loader: glob({ pattern: "**/[^_]*.{md,mdx}", base: "./src/content/pages" }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    ogImage: z.string().optional(),
    canonicalURL: z.string().optional(),
  }),
});

export const collections = { posts, pages };
