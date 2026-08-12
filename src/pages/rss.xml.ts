import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import { createMarkdownProcessor } from "@astrojs/markdown-remark";
import { getSortedPosts } from "@/utils/getSortedPosts";
import { getPostUrl } from "@/utils/getPostPaths";
import config from "@/config";

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export async function GET() {
  const posts = await getCollection("posts");
  const sortedPosts = getSortedPosts(posts);
  const processor = await createMarkdownProcessor({ syntaxHighlight: false });

  const items = await Promise.all(
    sortedPosts.map(async ({ data, id, filePath, body, rendered }) => {
      const link = new URL(
        getPostUrl(id, filePath, config.site.lang),
        config.site.url
      ).href;
      const content =
        rendered?.html ??
        (body
          ? (
              await processor.render(body, {
                frontmatter: data,
              })
            ).code
          : undefined);

      return {
        link,
        title: data.title,
        description: data.description,
        content,
        pubDate: new Date(data.pubDatetime),
        categories: data.tags,
        customData: data.modDatetime
          ? `<atom:updated>${escapeXml(new Date(data.modDatetime).toISOString())}</atom:updated>`
          : undefined,
      };
    })
  );

  return rss({
    title: config.site.title,
    description: config.site.description,
    site: config.site.url,
    items,
    xmlns: { atom: "http://www.w3.org/2005/Atom" },
    customData: `<language>${escapeXml(config.site.lang)}</language><lastBuildDate>${new Date().toUTCString()}</lastBuildDate><atom:link href="${escapeXml(new URL("rss.xml", config.site.url).href)}" rel="self" type="application/rss+xml" />`,
  });
}
