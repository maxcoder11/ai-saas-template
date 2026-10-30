/**
 * 【博客文章内容初始化 / 数据灌入脚本】
 * 
 * 作用：读取项目本地 `content/posts/` 目录中的 Markdown 博客，批量写入数据库 `post` 与 `taxonomy` 表。
 * 适用场景：新环境部署、数据库重置后初始化 SEO 博客文章。
 * 
 * 运行方式：
 * tsx scripts/seed-blogs.ts
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import fs from "fs";
import { db } from "@/core/db";
import { post, taxonomy, user } from "@/config/db/schema";
import { eq, and } from "drizzle-orm";
import { getUuid } from "@/shared/lib/hash";

interface BlogSeed {
  slug: string;
  title: string;
  description: string;
  categoryName: string;
  categoryTitle: string;
  filePath: string;
  coverUrl: string;
  authorName: string;
  authorAvatarUrl: string;
  locale: string;
}

const blogsToSeed: BlogSeed[] = [];

async function seed() {
  console.log("Starting Blog Seeding Script for ShipAny2...");

  if (blogsToSeed.length === 0) {
    console.log("No blog entries configured.");
    return;
  }

  // Get or create a valid user
  let [currentUser] = await db().select().from(user).limit(1);
  if (!currentUser) {
    const newUserId = getUuid();
    await db().insert(user).values({
      id: newUserId,
      name: "System Admin",
      email: "admin@seadance.video",
    });
    [currentUser] = await db().select().from(user).where(eq(user.id, newUserId)).limit(1);
  }

  const systemUserId = currentUser.id;
  console.log(`Using user ID: ${systemUserId}`);

  for (const blog of blogsToSeed) {
    if (!fs.existsSync(blog.filePath)) {
      console.error(`File not found: ${blog.filePath}`);
      continue;
    }

    const content = fs.readFileSync(blog.filePath, "utf-8");

    // 1. Ensure category exists in taxonomy
    let [existingCategory] = await db()
      .select()
      .from(taxonomy)
      .where(eq(taxonomy.slug, blog.categoryName))
      .limit(1);

    let categorySlug: string;
    if (!existingCategory) {
      const catId = getUuid();
      await db().insert(taxonomy).values({
        id: catId,
        userId: systemUserId,
        slug: blog.categoryName,
        type: "category",
        title: blog.categoryTitle,
        description: `${blog.categoryTitle} for Seedance AI Video Generator`,
        status: "online",
        sort: 10,
      });
      categorySlug = blog.categoryName;
      console.log(`Created taxonomy category: ${blog.categoryTitle} (${blog.categoryName})`);
    } else {
      categorySlug = existingCategory.slug;
      console.log(`Using existing taxonomy category: ${existingCategory.title}`);
    }

    // 2. Check if post already exists
    const [existingPost] = await db()
      .select()
      .from(post)
      .where(eq(post.slug, blog.slug))
      .limit(1);

    if (existingPost) {
      await db()
        .update(post)
        .set({
          title: blog.title,
          description: blog.description,
          content: content,
          status: "online",
          image: blog.coverUrl,
          categories: categorySlug,
          authorName: blog.authorName,
          authorImage: blog.authorAvatarUrl,
          updatedAt: new Date(),
        })
        .where(eq(post.id, existingPost.id));
      console.log(`Updated existing post: ${blog.slug}`);
    } else {
      const postId = getUuid();
      await db().insert(post).values({
        id: postId,
        userId: systemUserId,
        slug: blog.slug,
        type: "post",
        title: blog.title,
        description: blog.description,
        content: content,
        categories: categorySlug,
        status: "online",
        image: blog.coverUrl,
        authorName: blog.authorName,
        authorImage: blog.authorAvatarUrl,
        sort: 0,
      });
      console.log(`Inserted new post: ${blog.slug} (${postId})`);
    }
  }

  console.log("Blog Seeding Completed Successfully for ShipAny2!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Error during blog seeding:", err);
  process.exit(1);
});
