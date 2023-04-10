import { Prisma } from '@prisma/client'
import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import {
  addPostSchema,
  ListPostsInputSchema,
  listPostsInputSchema,
} from '~/schemas/post'
import { protectedProcedure, router } from '~/server/trpc'
import { defaultPostSelect, withCommentsPostSelect } from './post.select'
import { processFeedbackItem } from './post.util'

export const postRouter = router({
  list: protectedProcedure
    .input(listPostsInputSchema)
    .query(async ({ input, ctx }) => {
      /**
       * For pagination docs you can have a look here
       * @see https://trpc.io/docs/useInfiniteQuery
       * @see https://www.prisma.io/docs/concepts/components/prisma-client/pagination
       */

      const limit = input.limit ?? 50
      const { cursor } = input

      const getFilterWhereClause = (
        filter: ListPostsInputSchema['filter']
      ): Prisma.PostWhereInput => {
        switch (filter) {
          case 'all':
            return {}
          case 'draft':
            return {
              published: false,
            }
          case 'unread':
            return {
              NOT: {
                readBy: {
                  some: {
                    userId: ctx.session.user.id,
                  },
                },
              },
            }
          case 'replied':
            return {
              comments: {
                some: {},
              },
            }
          case 'repliedByMe':
            return {
              comments: {
                some: {
                  authorId: ctx.session.user.id,
                },
              },
            }
          case 'unreplied':
            return {
              comments: {
                none: {},
              },
            }
          case 'unrepliedByMe':
            return {
              comments: {
                none: {
                  authorId: ctx.session.user.id,
                },
              },
            }
        }
      }

      const items = await ctx.prisma.post.findMany({
        select: withCommentsPostSelect,
        // get an extra item at the end which we'll use as next cursor
        take: limit + 1,
        cursor: cursor
          ? {
              id: cursor,
            }
          : undefined,
        orderBy: {
          createdAt: input.order,
        },
        where: getFilterWhereClause(input.filter),
      })
      let nextCursor: typeof cursor | undefined = undefined
      if (items.length > limit) {
        // Remove the last item and use it as next cursor

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const nextItem = items.pop()!
        nextCursor = nextItem.id
      }

      const processedItems = items
        .map((item) => processFeedbackItem(item, ctx.session.user.id))
        .reverse()

      return {
        items: processedItems,
        nextCursor,
      }
    }),
  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    const { user } = ctx.session
    const readCount = await ctx.prisma.readPosts.count({
      where: {
        userId: user.id,
      },
    })
    const allVisiblePostsCount = await ctx.prisma.post.count({
      where: {
        hidden: false,
      },
    })
    return {
      unreadCount: allVisiblePostsCount - readCount,
      totalCount: allVisiblePostsCount,
    }
  }),
  byId: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      const { id } = input
      const post = await ctx.prisma.post.findUnique({
        where: { id },
        select: withCommentsPostSelect,
      })
      if (!post) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `No post with id '${id}'`,
        })
      }

      return processFeedbackItem(post, ctx.session.user.id)
    }),
  add: protectedProcedure
    .input(addPostSchema)
    .mutation(async ({ input, ctx }) => {
      const post = await ctx.prisma.post.create({
        data: {
          ...input,
          author: {
            connect: {
              id: ctx.session.user.id,
            },
          },
        },
        select: defaultPostSelect,
      })
      return post
    }),
  setRead: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id } = input
      const readPost = await ctx.prisma.readPosts.upsert({
        where: {
          postId_userId: {
            userId: ctx.session.user.id,
            postId: id,
          },
        },
        update: {},
        create: {
          user: {
            connect: {
              id: ctx.session.user.id,
            },
          },
          post: {
            connect: {
              id,
            },
          },
        },
      })
      return readPost
    }),
})