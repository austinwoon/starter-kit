/**
 * This is your entry point to setup the root configuration for tRPC on the server.
 * - `initTRPC` should only be used once per app.
 * - We export only the functionality that we use so we can enforce which base procedures should be used
 *
 * Learn how to create protected base procedures and other things below:
 * @see https://trpc.io/docs/v10/router
 * @see https://trpc.io/docs/v10/procedures
 */
import { initTRPC, TRPCError } from '@trpc/server'
import { trace } from 'OTEL-initializer'
import superjson from 'superjson'
import { ZodError } from 'zod'
import { Context } from './context'
import { prisma } from './prisma'

const t = initTRPC.context<Context>().create({
  /**
   * @see https://trpc.io/docs/v10/data-transformers
   */
  transformer: superjson,
  /**
   * @see https://trpc.io/docs/v10/error-formatting
   */
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.code === 'BAD_REQUEST' && error.cause instanceof ZodError
            ? error.cause.flatten()
            : null,
      },
    }
  },
})

/**
 * Create a router
 * @see https://trpc.io/docs/v10/router
 */
export const router = t.router

const tracingMiddleware = t.middleware(async ({ path, next }) => {
  return trace.getTracer('trpc').startActiveSpan(path, async (span) => {
    try {
      return await next()
    } finally {
      span.end()
    }
  })
})

const authMiddleware = t.middleware(({ next, ctx }) => {
  if (
    !ctx.session?.user ||
    !prisma.user.findUnique({ where: { id: ctx.session.user.id } })
  ) {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }
  return next({
    ctx: {
      session: {
        user: ctx.session.user,
      },
    },
  })
})

/**
 * Create an unprotected procedure
 * @see https://trpc.io/docs/v10/procedures
 **/
export const publicProcedure = t.procedure.use(tracingMiddleware)

/**
 * Create a protected procedure
 **/
export const protectedProcedure = t.procedure
  .use(tracingMiddleware)
  .use(authMiddleware)

/**
 * @see https://trpc.io/docs/v10/middlewares
 */
export const middleware = t.middleware

/**
 * @see https://trpc.io/docs/v10/merging-routers
 */
export const mergeRouters = t.mergeRouters
