/*!
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

import { Meter } from './Meter';
import { MeterRegistry } from './MeterRegistry';
import { NOOP_METER } from './NoopMeter';

/**
 * An implementation of the {@link MeterRegistry} which returns an impotent Meter
 * for all calls to `getMeter`
 */
export class NoopMeterRegistry implements MeterRegistry {
  getMeter(_name?: string, _version?: string): Meter {
    return NOOP_METER;
  }
}

export const NOOP_METER_REGISTRY = new NoopMeterRegistry();
