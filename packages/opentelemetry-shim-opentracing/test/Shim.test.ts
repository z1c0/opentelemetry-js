/**
 * Copyright 2019, OpenTelemetry Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as assert from 'assert';
import * as opentracing from 'opentracing';
import { BasicTracerRegistry, Span } from '@opentelemetry/tracing';
import { TracerShim, SpanShim, SpanContextShim } from '../src/shim';
import { INVALID_SPAN_CONTEXT, timeInputToHrTime } from '@opentelemetry/core';
import { performance } from 'perf_hooks';

describe('OpenTracing Shim', () => {
  const registry = new BasicTracerRegistry();
  const shimTracer: opentracing.Tracer = new TracerShim(
    registry.getTracer('default')
  );
  opentracing.initGlobalTracer(shimTracer);

  describe('TracerShim', () => {
    let span: opentracing.Span;
    let context: opentracing.SpanContext;

    beforeEach(() => {
      span = shimTracer.startSpan('my-span');
      context = span.context();
    });

    describe('propagation', () => {
      it('injects/extracts a span object', () => {
        const carrier: { [key: string]: unknown } = {};
        shimTracer.inject(span, opentracing.FORMAT_HTTP_HEADERS, carrier);
        const extractedContext = shimTracer.extract(
          opentracing.FORMAT_HTTP_HEADERS,
          carrier
        );
        assert.ok(extractedContext !== null);
        assert.strictEqual(context.toTraceId(), extractedContext!.toTraceId());
        assert.strictEqual(context.toSpanId(), extractedContext!.toSpanId());
      });

      it('injects/extracts HTTP carriers', () => {
        const carrier: { [key: string]: unknown } = {};
        shimTracer.inject(context, opentracing.FORMAT_HTTP_HEADERS, carrier);
        const extractedContext = shimTracer.extract(
          opentracing.FORMAT_HTTP_HEADERS,
          carrier
        );
        assert.ok(extractedContext !== null);
        assert.strictEqual(context.toTraceId(), extractedContext!.toTraceId());
        assert.strictEqual(context.toSpanId(), extractedContext!.toSpanId());
      });

      it('injects/extracts TextMap carriers', () => {
        const carrier: { [key: string]: unknown } = {};
        shimTracer.inject(context, opentracing.FORMAT_TEXT_MAP, carrier);
        const extractedContext = shimTracer.extract(
          opentracing.FORMAT_TEXT_MAP,
          carrier
        );
        assert.ok(extractedContext !== null);
        assert.strictEqual(context.toTraceId(), extractedContext!.toTraceId());
        assert.strictEqual(context.toSpanId(), extractedContext!.toSpanId());
      });

      it('injects/extracts Binary carriers', () => {
        /* const carrier = new Array(); */
        /* shimTracer.inject(context, opentracing.FORMAT_BINARY, carrier); */
        /* const extractedContext = shimTracer.extract(opentracing.FORMAT_BINARY, { buffer: new Uint8Array(carrier)}); */
        /* assert.strictEqual(context.toSpanId(), extractedContext.toSpanId()) */
      });
    });

    it('creates parent/child relationship using a span object', () => {
      const childSpan = shimTracer.startSpan('other-span', {
        childOf: span,
      }) as SpanShim;
      assert.strictEqual(
        (childSpan.getSpan() as Span).parentSpanId,
        context.toSpanId()
      );
      assert.strictEqual(
        childSpan.context().toTraceId(),
        span.context().toTraceId()
      );
    });

    it('creates parent/child relationship using a context object', () => {
      const childSpan = shimTracer.startSpan('other-span', {
        childOf: context,
      }) as SpanShim;
      assert.strictEqual(
        (childSpan.getSpan() as Span).parentSpanId,
        context.toSpanId()
      );
      assert.strictEqual(
        childSpan.context().toTraceId(),
        span.context().toTraceId()
      );
    });

    it('translates span options correctly', () => {
      const now = performance.now();
      const opentracingOptions: opentracing.SpanOptions = {
        startTime: now,
        tags: { key: 'value', count: 1 },
        references: [opentracing.followsFrom(context)],
      };
      span = shimTracer.startSpan('my-span', opentracingOptions);

      const otSpan = (span as SpanShim).getSpan() as Span;

      assert.strictEqual(otSpan.links.length, 1);
      assert.deepStrictEqual(otSpan.startTime, timeInputToHrTime(now));
      assert.deepStrictEqual(otSpan.attributes, opentracingOptions.tags);
    });
  });

  describe('SpanContextShim', () => {
    it('returns the correct context', () => {
      const shim = new SpanContextShim(INVALID_SPAN_CONTEXT);
      assert.strictEqual(shim.getSpanContext(), INVALID_SPAN_CONTEXT);
      assert.strictEqual(shim.toTraceId(), INVALID_SPAN_CONTEXT.traceId);
      assert.strictEqual(shim.toSpanId(), INVALID_SPAN_CONTEXT.spanId);
    });
  });

  describe('span', () => {
    let span: SpanShim;
    let otSpan: Span;

    beforeEach(() => {
      span = shimTracer.startSpan('my-span', {
        startTime: performance.now(),
      }) as SpanShim;
      otSpan = (span as SpanShim).getSpan() as Span;
    });

    it('sets tags', () => {
      span.setTag('hello', 'world');
      assert.strictEqual(otSpan.attributes.hello, 'world');

      span.addTags({ hello: 'stars', from: 'earth' });
      assert.strictEqual(otSpan.attributes.hello, 'stars');
      assert.strictEqual(otSpan.attributes.from, 'earth');
    });

    it('logs KV pairs', () => {
      const kvLogs = { key: 'value', error: 'not a valid span' };
      span.log(kvLogs);
      assert.strictEqual(otSpan.events[0].name, 'log');
      assert.strictEqual(otSpan.events[0].attributes, kvLogs);
    });

    it('logs an event with a payload', () => {
      const payload = { user: 'payload', request: 1 };
      span.logEvent('some log', payload);
      assert.strictEqual(otSpan.events[0].name, 'some log');
      assert.deepStrictEqual(otSpan.events[0].attributes, { payload });
    });

    it('updates the name', () => {
      assert.strictEqual(otSpan.name, 'my-span');
      span.setOperationName('your-span');
      assert.strictEqual(otSpan.name, 'your-span');
    });

    it('sets explicit end timestamp', () => {
      const now = performance.now();
      span.finish(now);
      assert.deepStrictEqual(otSpan.endTime, timeInputToHrTime(now));
    });

    it('can set and retrieve baggage', () => {
      span.setBaggageItem('baggage', 'item');
      // TODO: baggage
    });
  });
});
