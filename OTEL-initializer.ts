/**
 * Allows for OpenTelemetry tracing. Used primary in trpc middlewares,
 * though you should also invoke it in any API handlers that you want
 * to trace.
 *
 * See https://vercel.com/docs/concepts/observability/otel-overview/quickstart.
 */

import { trace, context } from '@opentelemetry/api'
import { registerOTel } from '@vercel/otel'

registerOTel('Starter Kit')

export { trace, context }
